import {
  FALLBACK_CLIENT_ID,
  forceRefresh,
  getValidAccessToken,
  loginWithOidc,
  loginWithStaticToken,
  logout,
  useAuthStore,
} from '@/auth/authManager';
import { useContextsStore } from '@/contexts/store';
import type { LagoonContext } from '@/contexts/types';

const mockSecureStore: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockSecureStore[k] = v;
  }),
  getItemAsync: jest.fn(async (k: string) => mockSecureStore[k] ?? null),
  deleteItemAsync: jest.fn(async (k: string) => {
    delete mockSecureStore[k];
  }),
}));

const mockRefreshAsync = jest.fn();
const mockExchangeCodeAsync = jest.fn();
// Keyed by clientId so tests can script a different outcome per candidate.
const mockPromptResults: Record<string, (() => unknown)[]> = {};
function queuePrompt(clientId: string, result: () => unknown) {
  (mockPromptResults[clientId] ??= []).push(result);
}

jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn().mockImplementation((config: { clientId: string }) => ({
    codeVerifier: 'verifier',
    promptAsync: jest.fn(async () => {
      const queue = mockPromptResults[config.clientId];
      const next = queue?.shift();
      if (!next) throw new Error(`no queued prompt result for client ${config.clientId}`);
      return next();
    }),
  })),
  fetchDiscoveryAsync: jest.fn(async () => ({ tokenEndpoint: 'https://kc.example.com/token' })),
  makeRedirectUri: jest.fn(() => 'lagoonmobile://auth'),
  exchangeCodeAsync: (...args: unknown[]) => mockExchangeCodeAsync(...args),
  refreshAsync: (...args: unknown[]) => mockRefreshAsync(...args),
}));

function makeJwt(expiresInSeconds: number): string {
  const json = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  const payload = globalThis
    .btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.sig`;
}

const context: LagoonContext = {
  id: 'ctx_test',
  name: 'Test',
  graphqlUrl: 'https://api.example.com/graphql',
  keycloakBaseUrl: 'https://keycloak.example.com',
  keycloakRealm: 'lagoon',
  keycloakClientId: 'lagoon-ui',
  authMode: 'oidc',
};

describe('authManager', () => {
  beforeEach(async () => {
    mockRefreshAsync.mockReset();
    mockExchangeCodeAsync.mockReset();
    for (const key of Object.keys(mockPromptResults)) delete mockPromptResults[key];
    for (const key of Object.keys(mockSecureStore)) delete mockSecureStore[key];
    useContextsStore.setState({ contexts: [context], activeContextId: context.id });
    await logout(context.id);
  });

  it('returns a fresh in-memory token without refreshing', async () => {
    const token = makeJwt(300);
    useAuthStore.getState().setSession(context.id, {
      accessToken: token,
      expiresAtMs: Date.now() + 300_000,
      isStatic: false,
    });
    await expect(getValidAccessToken(context)).resolves.toBe(token);
    expect(mockRefreshAsync).not.toHaveBeenCalled();
  });

  it('refreshes an expired token using the stored refresh token', async () => {
    mockSecureStore['lagoon.refresh.ctx_test'] = 'refresh-1';
    const newToken = makeJwt(300);
    mockRefreshAsync.mockResolvedValue({
      accessToken: newToken,
      refreshToken: 'refresh-2',
      expiresIn: 300,
      issuedAt: Math.floor(Date.now() / 1000),
    });

    useAuthStore.getState().setSession(context.id, {
      accessToken: makeJwt(-10),
      expiresAtMs: Date.now() - 10_000,
      isStatic: false,
    });

    await expect(getValidAccessToken(context)).resolves.toBe(newToken);
    expect(mockRefreshAsync).toHaveBeenCalledTimes(1);
    expect(mockSecureStore['lagoon.refresh.ctx_test']).toBe('refresh-2');
  });

  it('deduplicates concurrent refreshes (single flight)', async () => {
    mockSecureStore['lagoon.refresh.ctx_test'] = 'refresh-1';
    const newToken = makeJwt(300);
    mockRefreshAsync.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ accessToken: newToken, expiresIn: 300, issuedAt: Date.now() / 1000 }),
            20,
          ),
        ),
    );

    const results = await Promise.all([
      getValidAccessToken(context),
      getValidAccessToken(context),
      getValidAccessToken(context),
    ]);

    expect(results).toEqual([newToken, newToken, newToken]);
    expect(mockRefreshAsync).toHaveBeenCalledTimes(1);
  });

  it('returns null when refresh fails and no session exists', async () => {
    mockSecureStore['lagoon.refresh.ctx_test'] = 'refresh-1';
    mockRefreshAsync.mockRejectedValue(new Error('invalid_grant'));
    await expect(getValidAccessToken(context)).resolves.toBeNull();
  });

  it('restores a static token from secure storage on cold start', async () => {
    const staticContext = { ...context, authMode: 'static-token' as const };
    const token = makeJwt(3600);
    await loginWithStaticToken(staticContext, `  ${token}  `);
    useAuthStore.getState().dropSession(context.id); // simulate app restart

    await expect(getValidAccessToken(staticContext)).resolves.toBe(token);
    expect(mockRefreshAsync).not.toHaveBeenCalled();
  });

  it('returns null for an expired static token instead of refreshing', async () => {
    const staticContext = { ...context, authMode: 'static-token' as const };
    await loginWithStaticToken(staticContext, makeJwt(-60));
    await expect(getValidAccessToken(staticContext)).resolves.toBeNull();
    expect(mockRefreshAsync).not.toHaveBeenCalled();
  });

  it('forceRefresh drops the session and never refreshes static contexts', async () => {
    const staticContext = { ...context, authMode: 'static-token' as const };
    await loginWithStaticToken(staticContext, makeJwt(3600));
    await expect(forceRefresh(staticContext)).resolves.toBeNull();
  });

  it('logout clears session and stored tokens', async () => {
    mockSecureStore['lagoon.refresh.ctx_test'] = 'refresh-1';
    useAuthStore.getState().setSession(context.id, {
      accessToken: makeJwt(300),
      expiresAtMs: Date.now() + 300_000,
      isStatic: false,
    });
    await logout(context.id);
    expect(useAuthStore.getState().sessions[context.id]).toBeUndefined();
    expect(mockSecureStore['lagoon.refresh.ctx_test']).toBeUndefined();
  });

  describe('loginWithOidc client id fallback', () => {
    it('succeeds on the default client without touching the fallback', async () => {
      queuePrompt('lagoon-ui', () => ({ type: 'success', params: { code: 'abc' } }));
      mockExchangeCodeAsync.mockResolvedValue({ accessToken: makeJwt(300) });

      await loginWithOidc(context);

      expect(mockExchangeCodeAsync).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'lagoon-ui' }),
        expect.anything(),
      );
      expect(useContextsStore.getState().contexts[0].keycloakClientId).toBe('lagoon-ui');
    });

    it('falls back to lagoon-mobile when lagoon-ui is rejected for its redirect URI, and persists it', async () => {
      queuePrompt('lagoon-ui', () => ({
        type: 'error',
        params: {
          error: 'unauthorized_client',
          error_description: 'Invalid parameter: redirect_uri',
        },
      }));
      queuePrompt(FALLBACK_CLIENT_ID, () => ({ type: 'success', params: { code: 'abc' } }));
      mockExchangeCodeAsync.mockResolvedValue({ accessToken: makeJwt(300) });

      await loginWithOidc(context);

      expect(mockExchangeCodeAsync).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: FALLBACK_CLIENT_ID }),
        expect.anything(),
      );
      expect(useContextsStore.getState().contexts[0].keycloakClientId).toBe(FALLBACK_CLIENT_ID);
    });

    it('falls back to lagoon-mobile on an ambiguous dismissal too', async () => {
      queuePrompt('lagoon-ui', () => ({ type: 'dismiss' }));
      queuePrompt(FALLBACK_CLIENT_ID, () => ({ type: 'success', params: { code: 'abc' } }));
      mockExchangeCodeAsync.mockResolvedValue({ accessToken: makeJwt(300) });

      await loginWithOidc(context);

      expect(useContextsStore.getState().contexts[0].keycloakClientId).toBe(FALLBACK_CLIENT_ID);
    });

    it('never tries the fallback when a non-default client id was set on purpose', async () => {
      const customContext = { ...context, keycloakClientId: 'my-custom-client' };
      useContextsStore.setState({ contexts: [customContext], activeContextId: customContext.id });
      queuePrompt('my-custom-client', () => ({ type: 'dismiss' }));

      await expect(loginWithOidc(customContext)).rejects.toThrow();

      expect(mockPromptResults[FALLBACK_CLIENT_ID]).toBeUndefined();
      expect(useContextsStore.getState().contexts[0].keycloakClientId).toBe('my-custom-client');
    });

    it('surfaces the redirect guidance when both the default and fallback client fail', async () => {
      queuePrompt('lagoon-ui', () => ({
        type: 'error',
        params: {
          error: 'unauthorized_client',
          error_description: 'Invalid parameter: redirect_uri',
        },
      }));
      queuePrompt(FALLBACK_CLIENT_ID, () => ({
        type: 'error',
        params: {
          error: 'unauthorized_client',
          error_description: 'Invalid parameter: redirect_uri',
        },
      }));

      await expect(loginWithOidc(context)).rejects.toThrow(/redirect_uri/);
    });
  });
});
