import type { ApolloClient } from '@apollo/client';
import semver from 'semver';

import { useContextsStore } from '@/contexts/store';
import type { LagoonContext } from '@/contexts/types';
import { LagoonVersionDocument } from '@/graphql/generated/graphql';

/**
 * Minimum Lagoon core versions for optional API surface.
 *
 * The field thresholds were measured by validating against `typeDefs.js` at
 * tagged releases (2.8, 2.9, 2.12, 2.15, 2.18, 2.21, 2.24, 2.27, 2.30, 2.33).
 * Sampling was coarse, so each is a safe **upper bound** — a field may have
 * landed one or two minors earlier. Erring high only withholds cosmetic detail
 * on a narrow version band; erring low would break the whole query, since
 * Lagoon rejects a query naming any unknown field.
 */
const FEATURES = {
  /** Deployment.buildStep (>=2.12 measured) + Deployment.sourceUser (>=2.18) */
  deploymentDetails: '2.18.0',
  /** Task.sourceUser */
  taskDetails: '2.18.0',
  /** EnvironmentService.type + .updated */
  serviceDetails: '2.18.0',
  /** AdvancedTaskDefinitionArgument.defaultValue + .optional */
  taskArgumentMetadata: '2.18.0',
  /** graphql-sse endpoint at /graphql/stream + graphql-ws subscriptions */
  modernSubscriptions: '2.27.0',
  /** Deployment.buildType — measured >=2.30; no document selects it yet */
  deploymentBuildType: '2.30.0',
  /** Environment.idleState + idleOrUnidleEnvironment */
  idleState: '2.31.0',
  /** stopOrStartEnvironmentService */
  serviceActions: '2.31.0',
  /** project cloning API */
  cloneProject: '2.33.0',
  /** EnvironmentService.replicas — measured >=2.33; no document selects it yet */
  serviceReplicas: '2.33.0',
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
  } catch (error) {
    // Distinguishes "old Lagoon without lagoonVersion" from a failed probe.
    console.warn('[versionGate] lagoonVersion probe failed for context', contextId, error);
    return null;
  }
}
