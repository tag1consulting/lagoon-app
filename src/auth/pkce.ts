import {
  AuthRequest,
  DiscoveryDocument,
  fetchDiscoveryAsync,
  makeRedirectUri,
} from 'expo-auth-session';

import type { LagoonContext } from '@/contexts/types';
import { keycloakIssuerUrl } from '@/contexts/urlDerivation';

export const OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

const FALLBACK_REDIRECT_URI = 'lagoonmobile://auth';

let cachedDefaultRedirectUri: string | undefined;

/**
 * What the app asks Keycloak to redirect back to unless a context overrides it.
 *
 * Resolved lazily: `makeRedirectUri` reads the app scheme at call time and
 * throws where none is registered (jest, for one), which would otherwise take
 * down every module that transitively imports this one.
 */
export function getDefaultRedirectUri(): string {
  if (cachedDefaultRedirectUri === undefined) {
    try {
      cachedDefaultRedirectUri = makeRedirectUri({ scheme: 'lagoonmobile', path: 'auth' });
    } catch {
      cachedDefaultRedirectUri = FALLBACK_REDIRECT_URI;
    }
  }
  return cachedDefaultRedirectUri;
}

/**
 * Effective redirect URI for a context. Overridable per context because the
 * value has to match a Valid Redirect URI on the instance's Keycloak client
 * exactly, and admins register whatever pattern suits their install — an
 * override avoids needing a rebuild to match it.
 */
export function redirectUriFor(context: Pick<LagoonContext, 'redirectUri'>): string {
  return context.redirectUri?.trim() || getDefaultRedirectUri();
}

const discoveryCache = new Map<string, DiscoveryDocument>();

export function issuerFor(context: LagoonContext): string {
  return keycloakIssuerUrl(context.keycloakBaseUrl, context.keycloakRealm);
}

export async function getDiscovery(context: LagoonContext): Promise<DiscoveryDocument> {
  const issuer = issuerFor(context);
  const cached = discoveryCache.get(issuer);
  if (cached) return cached;
  const discovery = await fetchDiscoveryAsync(issuer);
  discoveryCache.set(issuer, discovery);
  return discovery;
}

export function buildAuthRequest(context: LagoonContext, includeOfflineAccess: boolean) {
  return new AuthRequest({
    clientId: context.keycloakClientId,
    redirectUri: redirectUriFor(context),
    scopes: includeOfflineAccess
      ? OIDC_SCOPES
      : OIDC_SCOPES.filter((s) => s !== 'offline_access'),
    usePKCE: true,
  });
}
