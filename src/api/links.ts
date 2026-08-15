import { ApolloLink, HttpLink } from '@apollo/client';
import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
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

  return ApolloLink.from([authLink, errorLink, retryLink, httpLink]);
}
