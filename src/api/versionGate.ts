import type { ApolloClient } from '@apollo/client';
import semver from 'semver';

import { useContextsStore } from '@/contexts/store';
import type { LagoonContext } from '@/contexts/types';
import { LagoonVersionDocument } from '@/graphql/generated/graphql';

/** Minimum Lagoon core versions for optional API surface. */
const FEATURES = {
  /** graphql-sse endpoint at /graphql/stream + graphql-ws subscriptions */
  modernSubscriptions: '2.27.0',
  /** Environment.idleState + idleOrUnidleEnvironment */
  idleState: '2.31.0',
  /** stopOrStartEnvironmentService */
  serviceActions: '2.31.0',
  /** project cloning API */
  cloneProject: '2.33.0',
} as const;

export type Feature = keyof typeof FEATURES;

/**
 * Whether a context's Lagoon instance supports a feature. Unknown or
 * unparseable versions fail closed — core flows never consult this.
 */
export function hasFeature(context: Pick<LagoonContext, 'lagoonVersion'>, feature: Feature): boolean {
  const version = semver.coerce(context.lagoonVersion ?? '');
  if (!version) return false;
  return semver.gte(version, FEATURES[feature]);
}

/** Fetch and cache the instance version on the context record. */
export async function refreshLagoonVersion(
  client: ApolloClient,
  contextId: string,
): Promise<string | null> {
  try {
    const result = await client.query({
      query: LagoonVersionDocument,
      fetchPolicy: 'network-only',
    });
    const version =
      typeof result.data?.lagoonVersion === 'string' ? result.data.lagoonVersion : null;
    if (version) {
      useContextsStore.getState().updateContext(contextId, { lagoonVersion: version });
    }
    return version;
  } catch {
    return null;
  }
}
