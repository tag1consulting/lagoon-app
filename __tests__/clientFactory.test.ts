import { registerClientCleanup } from '@/api/clientFactory';
import { useContextsStore } from '@/contexts/store';
import {
  DEFAULT_KEYCLOAK_CLIENT_ID,
  DEFAULT_KEYCLOAK_REALM,
  type LagoonContextInput,
} from '@/contexts/types';

function makeInput(name: string): LagoonContextInput {
  return {
    name,
    graphqlUrl: `https://api.${name}.example.com/graphql`,
    keycloakBaseUrl: `https://keycloak.${name}.example.com`,
    keycloakRealm: DEFAULT_KEYCLOAK_REALM,
    keycloakClientId: DEFAULT_KEYCLOAK_CLIENT_ID,
    authMode: 'oidc',
  };
}

describe('registerClientCleanup', () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    useContextsStore.setState({ contexts: [], activeContextId: null });
    unsubscribe = registerClientCleanup();
  });

  afterEach(() => {
    unsubscribe();
  });

  it('clears a cached lagoonVersion when the endpoint is retargeted', () => {
    const ctx = useContextsStore.getState().addContext(makeInput('acme'));
    useContextsStore.getState().updateContext(ctx.id, { lagoonVersion: '2.20.0' });
    expect(useContextsStore.getState().contexts[0].lagoonVersion).toBe('2.20.0');

    useContextsStore
      .getState()
      .updateContext(ctx.id, { graphqlUrl: 'https://api.other-instance.example.com/graphql' });

    expect(useContextsStore.getState().contexts[0].lagoonVersion).toBeUndefined();
  });

  it('does not touch lagoonVersion for edits unrelated to the endpoint', () => {
    const ctx = useContextsStore.getState().addContext(makeInput('acme'));
    useContextsStore.getState().updateContext(ctx.id, { lagoonVersion: '2.20.0' });

    useContextsStore.getState().updateContext(ctx.id, { keycloakClientId: 'lagoon-mobile' });

    expect(useContextsStore.getState().contexts[0].lagoonVersion).toBe('2.20.0');
  });
});
