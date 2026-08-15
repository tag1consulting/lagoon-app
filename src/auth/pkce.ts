import {
  AuthRequest,
  DiscoveryDocument,
  fetchDiscoveryAsync,
  makeRedirectUri,
} from 'expo-auth-session';

import type { LagoonContext } from '@/contexts/types';
import { keycloakIssuerUrl } from '@/contexts/urlDerivation';

export const OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

export const redirectUri = makeRedirectUri({ scheme: 'lagoonmobile', path: 'auth' });

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
    redirectUri,
    scopes: includeOfflineAccess
      ? OIDC_SCOPES
      : OIDC_SCOPES.filter((s) => s !== 'offline_access'),
    usePKCE: true,
  });
}
