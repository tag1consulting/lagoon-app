/**
 * Derive sibling service URLs from a Lagoon GraphQL endpoint.
 *
 * Lagoon installs conventionally expose services on sibling subdomains:
 *   api.example.com → keycloak.example.com, ui.example.com
 * These are suggestions only — every derived field is user-editable.
 */

export interface DerivedUrls {
  keycloakBaseUrl: string;
  uiUrl: string;
}

/** Normalize user input into a full GraphQL endpoint URL, or null if unusable. */
export function normalizeGraphqlUrl(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!url.hostname || !url.hostname.includes('.')) return null;

  if (url.pathname === '/' || url.pathname === '') {
    url.pathname = '/graphql';
  }
  url.hash = '';
  url.search = '';
  return url.toString();
}

export function deriveUrls(graphqlUrl: string): DerivedUrls | null {
  let url: URL;
  try {
    url = new URL(graphqlUrl);
  } catch {
    return null;
  }

  const host = url.hostname;
  const parts = host.split('.');
  // Replace a conventional "api" left-most label; otherwise prefix the host.
  const base = parts[0] === 'api' ? parts.slice(1).join('.') : host;

  return {
    keycloakBaseUrl: `${url.protocol}//keycloak.${base}`,
    uiUrl: `${url.protocol}//ui.${base}`,
  };
}

/** Keycloak issuer URL for a context (Keycloak runs under the /auth path prefix in Lagoon). */
export function keycloakIssuerUrl(keycloakBaseUrl: string, realm: string): string {
  return `${keycloakBaseUrl.replace(/\/+$/, '')}/auth/realms/${encodeURIComponent(realm)}`;
}

/** True if a URL is plain http:// — tokens and credentials would cross the network unencrypted. */
export function isInsecureUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'http:';
  } catch {
    return false;
  }
}
