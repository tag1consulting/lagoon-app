import { exchangeCodeAsync, refreshAsync, TokenResponse } from 'expo-auth-session';
import { create } from 'zustand';

import { jwtExpiryMs } from '@/auth/jwt';
import { buildAuthRequest, getDiscovery, redirectUriFor } from '@/auth/pkce';
import {
  clearTokens,
  loadRefreshToken,
  loadStaticToken,
  saveRefreshToken,
  saveStaticToken,
} from '@/auth/secureTokens';
import { useContextsStore } from '@/contexts/store';
import { DEFAULT_KEYCLOAK_CLIENT_ID, type LagoonContext } from '@/contexts/types';

/**
 * Convention documented in CLAUDE.md for instances that lock down lagoon-ui's
 * redirect URIs: a dedicated public client named exactly this, standard flow
 * enabled, Valid Redirect URIs lagoonmobile://*. Tried automatically so a
 * fresh context works without the user finding and pasting a client ID by
 * hand — see the "Preferred fix" note in CLAUDE.md.
 */
export const FALLBACK_CLIENT_ID = 'lagoon-mobile';

/** Access token considered stale this many ms before its actual expiry. */
const EXPIRY_SLACK_MS = 30_000;

export type SessionStatus = 'signed-out' | 'signed-in' | 'expired';

interface Session {
  accessToken: string;
  /** ms since epoch; 0 = unknown (treat as valid until a 401 proves otherwise) */
  expiresAtMs: number;
  /** Whether this session came from a pasted token (no refresh possible). */
  isStatic: boolean;
}

export class LoginRedirectError extends Error {
  /** True when the failure looks like the Keycloak client rejecting our redirect URI. */
  readonly likelyRedirectUriProblem: boolean;

  constructor(message: string, likelyRedirectUriProblem: boolean) {
    super(message);
    this.name = 'LoginRedirectError';
    this.likelyRedirectUriProblem = likelyRedirectUriProblem;
  }
}

interface AuthState {
  // In-memory only — never persisted. Keyed by context id.
  sessions: Record<string, Session>;
  setSession: (contextId: string, session: Session) => void;
  dropSession: (contextId: string) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  sessions: {},
  setSession: (contextId, session) =>
    set((state) => ({ sessions: { ...state.sessions, [contextId]: session } })),
  dropSession: (contextId) =>
    set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[contextId];
      return { sessions };
    }),
}));

function sessionFromTokenResponse(response: TokenResponse): Session {
  const fromJwt = jwtExpiryMs(response.accessToken);
  const fromResponse = response.expiresIn
    ? (response.issuedAt ?? Math.floor(Date.now() / 1000)) * 1000 + response.expiresIn * 1000
    : null;
  return {
    accessToken: response.accessToken,
    expiresAtMs: fromJwt ?? fromResponse ?? 0,
    isStatic: false,
  };
}

async function persistRefreshToken(contextId: string, response: TokenResponse): Promise<void> {
  if (response.refreshToken) {
    await saveRefreshToken(contextId, response.refreshToken);
  }
}

/**
 * Interactive OIDC login: opens the system browser for the Keycloak PKCE flow.
 * Retries once without the offline_access scope if the realm rejects it.
 *
 * If the context still has the default lagoon-ui client id (i.e. the user
 * hasn't pointed it at something else on purpose) and that attempt looks like
 * a redirect-URI rejection, retries once more against the lagoon-mobile
 * convention before surfacing the manual guidance panel — many instances
 * lock down lagoon-ui's redirect URIs and expect that dedicated client
 * instead (see CLAUDE.md). A successful client id is persisted onto the
 * context so refresh (which reads context.keycloakClientId directly) keeps
 * working without repeating this fallback on every launch.
 *
 * Trade-off: because a dismissal is indistinguishable from a redirect-URI
 * rejection (see below), a genuine cancel on a stock instance (lagoon-ui
 * works, user just closed the browser) also triggers one extra automatic
 * reopen against lagoon-mobile before giving up — bounded to exactly one
 * extra attempt, only when the client id is still the default.
 */
export async function loginWithOidc(context: LagoonContext): Promise<void> {
  const clientIdCandidates =
    context.keycloakClientId === DEFAULT_KEYCLOAK_CLIENT_ID
      ? [DEFAULT_KEYCLOAK_CLIENT_ID, FALLBACK_CLIENT_ID]
      : [context.keycloakClientId];

  for (const clientId of clientIdCandidates) {
    const discovery = await getDiscovery(context);

    for (const withOffline of [true, false]) {
      const request = buildAuthRequest({ ...context, keycloakClientId: clientId }, withOffline);
      const result = await request.promptAsync(discovery);

      if (result.type === 'success' && result.params.code) {
        const tokenResponse = await exchangeCodeAsync(
          {
            clientId,
            redirectUri: redirectUriFor(context),
            code: result.params.code,
            extraParams: { code_verifier: request.codeVerifier ?? '' },
          },
          discovery,
        );
        if (clientId !== context.keycloakClientId) {
          useContextsStore.getState().updateContext(context.id, { keycloakClientId: clientId });
        }
        await persistRefreshToken(context.id, tokenResponse);
        useAuthStore.getState().setSession(context.id, sessionFromTokenResponse(tokenResponse));
        return;
      }

      if (result.type === 'error') {
        const code = result.params?.error ?? result.error?.code ?? '';
        if (withOffline && /invalid_scope|invalid_request/.test(code)) {
          continue; // realm may not allow offline_access — retry without it
        }
        const redirectProblem = /redirect/i.test(
          `${code} ${result.params?.error_description ?? ''} ${result.error?.description ?? ''}`,
        );
        if (redirectProblem && clientId !== clientIdCandidates[clientIdCandidates.length - 1]) {
          break; // try the next client id candidate
        }
        throw new LoginRedirectError(
          result.error?.description ?? result.params?.error_description ?? `Login failed (${code})`,
          redirectProblem,
        );
      }

      // Dismissal is ambiguous: the user may have closed the browser, but
      // Keycloak also renders its own "Invalid parameter: redirect_uri" page
      // and never redirects back, which reaches us as a dismissal rather than
      // an error. Treat it as a possible redirect problem either way and try
      // the next client id candidate (if any) — it is the only actionable
      // hint we can offer, and a genuine cancel simply ignores whatever we do
      // next.
      break;
    }
  }

  throw new LoginRedirectError(
    'Login did not complete. If the browser showed "Invalid parameter: redirect_uri", this instance needs the fix below.',
    true,
  );
}

/** Store a pasted API token for a static-token context. */
export async function loginWithStaticToken(context: LagoonContext, token: string): Promise<void> {
  const trimmed = token.trim();
  await saveStaticToken(context.id, trimmed);
  useAuthStore.getState().setSession(context.id, {
    accessToken: trimmed,
    expiresAtMs: jwtExpiryMs(trimmed) ?? 0,
    isStatic: true,
  });
}

// Single-flight refresh per context: concurrent callers share one promise.
const inflightRefreshes = new Map<string, Promise<Session | null>>();

async function refreshSession(context: LagoonContext): Promise<Session | null> {
  const existing = inflightRefreshes.get(context.id);
  if (existing) return existing;

  const task = (async (): Promise<Session | null> => {
    const refreshToken = await loadRefreshToken(context.id);
    if (!refreshToken) return null;
    try {
      const discovery = await getDiscovery(context);
      const response = await refreshAsync(
        { clientId: context.keycloakClientId, refreshToken },
        discovery,
      );
      await persistRefreshToken(context.id, response);
      const session = sessionFromTokenResponse(response);
      useAuthStore.getState().setSession(context.id, session);
      return session;
    } catch (error) {
      // Re-login is required either way, but the reason (invalid_grant vs a
      // network/discovery failure) matters when diagnosing a login loop.
      console.warn('[auth] token refresh failed for context', context.id, error);
      return null;
    }
  })();

  inflightRefreshes.set(context.id, task);
  try {
    return await task;
  } finally {
    inflightRefreshes.delete(context.id);
  }
}

function isFresh(session: Session): boolean {
  return session.expiresAtMs === 0 || session.expiresAtMs - Date.now() > EXPIRY_SLACK_MS;
}

/**
 * Return a usable access token for the context, refreshing if necessary.
 * Returns null when interactive login is required.
 */
export async function getValidAccessToken(context: LagoonContext): Promise<string | null> {
  const session = useAuthStore.getState().sessions[context.id];

  if (session?.isStatic) {
    return isFresh(session) ? session.accessToken : null;
  }
  if (session && isFresh(session)) {
    return session.accessToken;
  }

  if (context.authMode === 'static-token') {
    // Cold start: restore the pasted token from secure storage.
    const stored = await loadStaticToken(context.id);
    if (!stored) return null;
    const restored: Session = {
      accessToken: stored,
      expiresAtMs: jwtExpiryMs(stored) ?? 0,
      isStatic: true,
    };
    useAuthStore.getState().setSession(context.id, restored);
    return isFresh(restored) ? stored : null;
  }

  const refreshed = await refreshSession(context);
  return refreshed?.accessToken ?? null;
}

/**
 * Force a refresh (after a 401 whose token passed the local expiry check).
 * Returns the new token or null if re-login is needed.
 */
export async function forceRefresh(context: LagoonContext): Promise<string | null> {
  if (context.authMode === 'static-token') return null;
  useAuthStore.getState().dropSession(context.id);
  const refreshed = await refreshSession(context);
  return refreshed?.accessToken ?? null;
}

/** Session status for UI guards. */
export function useSessionStatus(contextId: string | null): SessionStatus {
  const session = useAuthStore((s) => (contextId ? s.sessions[contextId] : undefined));
  if (!session) return 'signed-out';
  return isFresh(session) ? 'signed-in' : 'expired';
}

export async function logout(contextId: string): Promise<void> {
  useAuthStore.getState().dropSession(contextId);
  await clearTokens(contextId);
}

/** Wire context deletion to token cleanup (registered once at app start). */
export function registerAuthCleanup(): () => void {
  let prev = useContextsStore.getState().contexts;
  return useContextsStore.subscribe((state) => {
    const removed = prev.filter((c) => !state.contexts.some((n) => n.id === c.id));
    prev = state.contexts;
    for (const context of removed) {
      void logout(context.id);
    }
  });
}
