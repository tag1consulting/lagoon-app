import { ApolloLink, HttpLink } from '@apollo/client';
import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';
import { Observable } from 'rxjs';

import { forceRefresh, getValidAccessToken, useAuthStore } from '@/auth/authManager';
import type { LagoonContext } from '@/contexts/types';

function isAuthError(error: unknown): boolean {
  if (ServerError.is(error)) {
    return error.statusCode === 401 || error.statusCode === 403;
  }
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors.some(
      (e) =>
        e.extensions?.code === 'UNAUTHENTICATED' ||
        /token|unauthorized|not authorized|access denied/i.test(e.message),
    );
  }
  return false;
}

export function buildLinkChain(context: LagoonContext): ApolloLink {
  const authLink = new SetContextLink(async (prevContext) => {
    const token = await getValidAccessToken(context);
    return {
      headers: {
        ...(prevContext.headers as Record<string, string> | undefined),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  // One forced-refresh retry when the server rejects a token our local
  // expiry check considered fine (revoked session, clock skew, …).
  const errorLink = new ErrorLink(({ error, operation, forward }) => {
    if (operation.getContext().authRetried || !isAuthError(error)) return;
    return new Observable((observer) => {
      forceRefresh(context)
        .then((token) => {
          if (!token) {
            // Re-login required; the session guard reacts to the dropped session.
            useAuthStore.getState().dropSession(context.id);
            observer.error(error);
            return;
          }
          operation.setContext({
            authRetried: true,
            headers: { authorization: `Bearer ${token}` },
          });
          forward(operation).subscribe(observer);
        })
        .catch((refreshError) => observer.error(refreshError));
    });
  });

  const retryLink = new RetryLink({
    attempts: {
      max: 3,
      retryIf: (error) => !isAuthError(error),
    },
    delay: { initial: 400, max: 4000, jitter: true },
  });

  const httpLink = new HttpLink({ uri: context.graphqlUrl });

  const httpChain = ApolloLink.from([authLink, errorLink, retryLink, httpLink]);

  // Subscriptions ride a lazy WebSocket (Lagoon >= 2.27 serves graphql-ws on
  // the same /graphql path). Auth goes via connectionParams, matching
  // lagoon-ui. Subscription failures are non-fatal — every consumer has a
  // polling fallback — so the socket retries quietly and closes when idle.
  const wsClient = createClient({
    url: context.graphqlUrl.replace(/^http/, 'ws'),
    lazy: true,
    lazyCloseTimeout: 30_000,
    retryAttempts: 5,
    connectionParams: async () => {
      const token = await getValidAccessToken(context);
      return token ? { authToken: token } : {};
    },
  });
  const wsLink = new GraphQLWsLink(wsClient);

  return ApolloLink.split(
    (operation) => operation.operationType === OperationTypeNode.SUBSCRIPTION,
    wsLink,
    httpChain,
  );
}
