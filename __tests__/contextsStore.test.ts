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

describe('contexts store', () => {
  beforeEach(() => {
    useContextsStore.setState({ contexts: [], activeContextId: null });
  });

  it('makes the first added context active', () => {
    const ctx = useContextsStore.getState().addContext(makeInput('sbs'));
    expect(useContextsStore.getState().activeContextId).toBe(ctx.id);
  });

  it('does not steal active status on later adds', () => {
    const first = useContextsStore.getState().addContext(makeInput('sbs'));
    useContextsStore.getState().addContext(makeInput('other'));
    expect(useContextsStore.getState().activeContextId).toBe(first.id);
  });

  it('switches active context, ignoring unknown ids', () => {
    useContextsStore.getState().addContext(makeInput('sbs'));
    const second = useContextsStore.getState().addContext(makeInput('other'));
    useContextsStore.getState().setActiveContext(second.id);
    expect(useContextsStore.getState().activeContextId).toBe(second.id);
    useContextsStore.getState().setActiveContext('nope');
    expect(useContextsStore.getState().activeContextId).toBe(second.id);
  });

  it('updates fields without changing identity', () => {
    const ctx = useContextsStore.getState().addContext(makeInput('sbs'));
    useContextsStore.getState().updateContext(ctx.id, { name: 'SBS prod', id: 'hax' } as never);
    const updated = useContextsStore.getState().contexts[0];
    expect(updated.id).toBe(ctx.id);
    expect(updated.name).toBe('SBS prod');
  });

  it('falls back to another context when the active one is removed', () => {
    const first = useContextsStore.getState().addContext(makeInput('sbs'));
    const second = useContextsStore.getState().addContext(makeInput('other'));
    useContextsStore.getState().removeContext(first.id);
    expect(useContextsStore.getState().activeContextId).toBe(second.id);
    useContextsStore.getState().removeContext(second.id);
    expect(useContextsStore.getState().activeContextId).toBeNull();
  });
});
