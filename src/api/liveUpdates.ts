import { useSubscription } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { hasFeature } from '@/api/versionGate';
import { useActiveContext } from '@/contexts/store';
import {
  BackupChangedDocument,
  DeploymentChangedDetailedDocument,
  DeploymentChangedDocument,
  TaskChangedDocument,
} from '@/graphql/generated/graphql';

/** True while the app is foregrounded — subscriptions pause in background. */
export function useAppStateActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * Live deployment-status events for an environment. Push-based enhancement
 * only: callers must keep their polling fallback — WebSockets may be blocked
 * by an instance's ingress, and errors here are deliberately swallowed.
 */
export function useDeploymentEvents(
  environmentId: number | null | undefined,
  onEvent: () => void,
): void {
  const active = useAppStateActive();
  const context = useActiveContext();
  useSubscription(
    hasFeature(context ?? {}, 'deploymentDetails')
      ? DeploymentChangedDetailedDocument
      : DeploymentChangedDocument,
    {
      variables: { environment: environmentId ?? 0 },
      skip: !environmentId || !active,
      onData: () => onEvent(),
      onError: (error) => {
        // Non-fatal: polling remains the fallback. Logged so a permanently
        // blocked WebSocket is visible rather than looking like idleness.
        console.warn('[liveUpdates] deployment subscription error', error);
      },
    },
  );
}

/** Live task-status events for an environment; same contract as deployments. */
export function useTaskEvents(
  environmentId: number | null | undefined,
  onEvent: () => void,
): void {
  const active = useAppStateActive();
  useSubscription(TaskChangedDocument, {
    variables: { environment: environmentId ?? 0 },
    skip: !environmentId || !active,
    onData: () => onEvent(),
    onError: (error) => {
      // Non-fatal: polling remains the fallback. See useDeploymentEvents.
      console.warn('[liveUpdates] task subscription error', error);
    },
  });
}

/** Live restore-status events for an environment; same contract as deployments. */
export function useBackupEvents(
  environmentId: number | null | undefined,
  onEvent: () => void,
): void {
  const active = useAppStateActive();
  useSubscription(BackupChangedDocument, {
    variables: { environment: environmentId ?? 0 },
    skip: !environmentId || !active,
    onData: () => onEvent(),
    onError: (error) => {
      // Non-fatal: polling remains the fallback. See useDeploymentEvents.
      console.warn('[liveUpdates] backup subscription error', error);
    },
  });
}
