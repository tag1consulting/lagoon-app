import { useSubscription } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
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
  useSubscription(DeploymentChangedDocument, {
    variables: { environment: environmentId ?? 0 },
    skip: !environmentId || !active,
    onData: () => onEvent(),
    onError: () => {
      /* polling covers this */
    },
  });
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
    onError: () => {
      /* polling covers this */
    },
  });
}
