import { useQuery } from '@apollo/client/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { durationLabel } from '@/components/DeploymentRow';
import { LogViewer } from '@/components/LogViewer';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/ui';
import { DeploymentWithLogDocument } from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';
import { isActiveStatus } from '@/theme/status';

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

  const { data, error, startPolling, stopPolling } = useQuery(DeploymentWithLogDocument, {
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

  // Poll while the build is live; stop once terminal.
  useEffect(() => {
    if (running) {
      startPolling(ACTIVE_POLL_MS);
      return () => stopPolling();
    }
    stopPolling();
  }, [running, startPolling, stopPolling]);

  return (
    <>
      <Stack.Screen options={{ title: deploymentName ?? 'Deployment' }} />
      <View style={styles.container}>
        {error ? <EmptyState title="Could not load deployment" body={error.message} /> : null}
        {deployment ? (
          <>
            <View style={styles.header}>
              <StatusBadge status={deployment.status} />
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                {deployment.buildStep ? `Step: ${deployment.buildStep} · ` : ''}
                {durationLabel(deployment.started, deployment.completed) ?? 'not started'}
                {deployment.sourceUser ? ` · by ${deployment.sourceUser}` : ''}
              </Text>
            </View>
            <LogViewer log={deployment.buildLog} running={running} />
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
});
