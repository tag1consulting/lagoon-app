import { useMutation, useQuery } from '@apollo/client/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDeploymentEvents } from '@/api/liveUpdates';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { durationLabel } from '@/components/DeploymentRow';
import { LogViewer } from '@/components/LogViewer';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/ui';
import {
  CancelDeploymentDocument,
  DeploymentWithLogDocument,
} from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';
import { isActiveStatus, isCancellableStatus } from '@/theme/status';

/** Refetch cadence for status + log while a build is running. */
const ACTIVE_POLL_MS = 10_000;

export default function DeploymentScreen() {
  const theme = useTheme();
  const { envName, projectId, deploymentName } = useLocalSearchParams<{
    project: string;
    envName: string;
    projectId: string;
    deploymentName: string;
  }>();

  const { data, error, refetch, startPolling, stopPolling } = useQuery(DeploymentWithLogDocument, {
    variables: {
      name: envName ?? '',
      project: Number(projectId),
      deploymentName: deploymentName ?? '',
    },
    skip: !envName || !projectId || !deploymentName,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'network-only',
  });

  const deployment = data?.environmentByName?.deployments?.find(
    (d) => d?.name === deploymentName,
  );
  const running = isActiveStatus(deployment?.status);

  // Status pushes trigger a log refetch (subscription payloads carry no log);
  // the poll below remains the fallback.
  useDeploymentEvents(data?.environmentByName?.id, () => void refetch());

  // Poll while the build is live; stop once terminal.
  useEffect(() => {
    if (running) {
      startPolling(ACTIVE_POLL_MS);
      return () => stopPolling();
    }
    stopPolling();
  }, [running, startPolling, stopPolling]);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelDeployment, { loading: cancelling }] = useMutation(CancelDeploymentDocument);

  const handleCancel = async () => {
    if (!deployment?.id) return;
    setCancelError(null);
    try {
      await cancelDeployment({ variables: { deploymentId: deployment.id } });
      setConfirmCancel(false);
      void refetch();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Could not cancel the deployment.');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: deploymentName ?? 'Deployment' }} />
      <View style={styles.container}>
        {error ? <EmptyState title="Could not load deployment" body={error.message} /> : null}
        {deployment ? (
          <>
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <StatusBadge status={deployment.status} />
                {isCancellableStatus(deployment.status) ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirmCancel(true)}
                  >
                    <Text style={{ color: theme.danger, fontSize: 13, fontWeight: '600' }}>
                      Cancel deployment
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                {deployment.buildStep ? `Step: ${deployment.buildStep} · ` : ''}
                {durationLabel(deployment.started, deployment.completed) ?? 'not started'}
                {deployment.sourceUser ? ` · by ${deployment.sourceUser}` : ''}
              </Text>
            </View>
            <LogViewer log={deployment.buildLog} running={running} />

            <ConfirmSheet
              visible={confirmCancel}
              title="Cancel this deployment?"
              message={`Stops the running build ${deployment.name ?? ''}.`}
              confirmLabel="Cancel deployment"
              destructive
              busy={cancelling}
              onConfirm={() => void handleCancel()}
              onDismiss={() => {
                setConfirmCancel(false);
                setCancelError(null);
              }}
            >
              {cancelError ? <Text style={{ color: theme.danger }}>{cancelError}</Text> : null}
            </ConfirmSheet>
          </>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
