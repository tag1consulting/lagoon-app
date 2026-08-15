import {
  forceRefresh,
  getValidAccessToken,
  loginWithStaticToken,
  logout,
  useAuthStore,
} from '@/auth/authManager';
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
jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn(),
  fetchDiscoveryAsync: jest.fn(async () => ({ tokenEndpoint: 'https://kc.example.com/token' })),
  makeRedirectUri: jest.fn(() => 'lagoonmobile://auth'),
  exchangeCodeAsync: jest.fn(),
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
    for (const key of Object.keys(mockSecureStore)) delete mockSecureStore[key];
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
});
