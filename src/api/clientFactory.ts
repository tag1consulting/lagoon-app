import { ApolloClient, InMemoryCache } from '@apollo/client';

import { buildLinkChain } from '@/api/links';
import { useContextsStore } from '@/contexts/store';
import type { LagoonContext } from '@/contexts/types';

/**
 * One ApolloClient per Lagoon context, each with its own normalized cache so
 * data never bleeds between clusters. Clients are built lazily and torn down
 * when their context is deleted.
 */
const clients = new Map<string, ApolloClient>();

function buildClient(context: LagoonContext): ApolloClient {
  return new ApolloClient({
    link: buildLinkChain(context),
    cache: new InMemoryCache({
      typePolicies: {
        Environment: {
          fields: {
            // Full-log fields are fetched with dedicated queries; never merge
            // giant strings into list-level cache entries.
            deployments: { merge: false },
            tasks: { merge: false },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network' },
    },
  });
}

export function getClient(context: LagoonContext): ApolloClient {
  let client = clients.get(context.id);
  if (!client) {
    client = buildClient(context);
    clients.set(context.id, client);
  }
  return client;
}

export function evictClient(contextId: string): void {
  const client = clients.get(contextId);
  if (!client) return;
  clients.delete(contextId);
  client.stop();
  void client.clearStore();
}

/**
 * Rebuild the client after connection-relevant edits (endpoint, client id).
 * Cheap to call — the next getClient() lazily rebuilds.
 */
export function invalidateClient(contextId: string): void {
  evictClient(contextId);
}

/** Tear down clients for deleted contexts (registered once at app start). */
export function registerClientCleanup(): () => void {
  let prev = useContextsStore.getState().contexts;
  return useContextsStore.subscribe((state) => {
    const removed = prev.filter((c) => !state.contexts.some((n) => n.id === c.id));
    const edited = state.contexts.filter((c) => {
      const before = prev.find((p) => p.id === c.id);
      return (
        before &&
        (before.graphqlUrl !== c.graphqlUrl ||
          before.keycloakBaseUrl !== c.keycloakBaseUrl ||
          before.keycloakClientId !== c.keycloakClientId ||
          before.authMode !== c.authMode)
      );
    });
    prev = state.contexts;
    for (const context of [...removed, ...edited]) {
      evictClient(context.id);
    }
  });
}
