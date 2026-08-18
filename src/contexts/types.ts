export type AuthMode = 'oidc' | 'static-token';

export interface LagoonContext {
  id: string;
  /** Display name, e.g. "Acme" or "amazee.io" */
  name: string;
  /** Full GraphQL endpoint, e.g. https://api.example.com/graphql */
  graphqlUrl: string;
  /** Keycloak base URL, e.g. https://keycloak.example.com — realm path appended separately */
  keycloakBaseUrl: string;
  /** Keycloak realm; Lagoon installs use "lagoon" */
  keycloakRealm: string;
  /** Public client used for the PKCE flow; lagoon-ui exists on every install */
  keycloakClientId: string;
  /**
   * Override for the OAuth redirect URI. Must match a Valid Redirect URI on
   * the Keycloak client exactly. Empty/undefined uses the app default
   * (`lagoonmobile://auth`).
   */
  redirectUri?: string;
  /** Optional web UI URL for external links */
  uiUrl?: string;
  authMode: AuthMode;
  /** Cached Lagoon core version (e.g. "2.28.0"), fetched after login */
  lagoonVersion?: string;
}

export type LagoonContextInput = Omit<LagoonContext, 'id' | 'lagoonVersion'>;

export const DEFAULT_KEYCLOAK_REALM = 'lagoon';
export const DEFAULT_KEYCLOAK_CLIENT_ID = 'lagoon-ui';
