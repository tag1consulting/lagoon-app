import {
  deriveUrls,
  keycloakIssuerUrl,
  normalizeGraphqlUrl,
} from '@/contexts/urlDerivation';

describe('normalizeGraphqlUrl', () => {
  it('adds https and /graphql to a bare host', () => {
    expect(normalizeGraphqlUrl('api.acme.example.com')).toBe('https://api.acme.example.com/graphql');
  });

  it('keeps an explicit path', () => {
    expect(normalizeGraphqlUrl('https://api.example.com/graphql')).toBe(
      'https://api.example.com/graphql',
    );
  });

  it('strips query and hash', () => {
    expect(normalizeGraphqlUrl('https://api.example.com/graphql?x=1#y')).toBe(
      'https://api.example.com/graphql',
    );
  });

  it('rejects garbage', () => {
    expect(normalizeGraphqlUrl('')).toBeNull();
    expect(normalizeGraphqlUrl('   ')).toBeNull();
    expect(normalizeGraphqlUrl('not a url')).toBeNull();
    expect(normalizeGraphqlUrl('localhost')).toBeNull();
  });
});

describe('deriveUrls', () => {
  it('replaces the api label with sibling services', () => {
    expect(deriveUrls('https://api.lagoon.example.com/graphql')).toEqual({
      keycloakBaseUrl: 'https://keycloak.lagoon.example.com',
      uiUrl: 'https://ui.lagoon.example.com',
    });
  });

  it('prefixes when the host has no api label', () => {
    expect(deriveUrls('https://lagoon.example.com/graphql')).toEqual({
      keycloakBaseUrl: 'https://keycloak.lagoon.example.com',
      uiUrl: 'https://ui.lagoon.example.com',
    });
  });

  it('returns null for invalid input', () => {
    expect(deriveUrls('nope')).toBeNull();
  });
});

describe('keycloakIssuerUrl', () => {
  it('appends the /auth realm path', () => {
    expect(keycloakIssuerUrl('https://keycloak.example.com', 'lagoon')).toBe(
      'https://keycloak.example.com/auth/realms/lagoon',
    );
  });

  it('tolerates trailing slashes', () => {
    expect(keycloakIssuerUrl('https://keycloak.example.com//', 'lagoon')).toBe(
      'https://keycloak.example.com/auth/realms/lagoon',
    );
  });
});
