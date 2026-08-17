import { useQuery } from '@apollo/client/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTaskEvents } from '@/api/liveUpdates';
import { durationLabel } from '@/components/DeploymentRow';
import { LogViewer } from '@/components/LogViewer';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/ui';
import { TaskWithLogDocument } from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';
import { isActiveStatus } from '@/theme/status';

const ACTIVE_POLL_MS = 10_000;

export default function TaskScreen() {
  const theme = useTheme();
  const { envName, projectId, taskName } = useLocalSearchParams<{
    project: string;
    envName: string;
    projectId: string;
    taskName: string;
  }>();

  const { data, error, refetch, startPolling, stopPolling } = useQuery(TaskWithLogDocument, {
    variables: { name: envName ?? '', project: Number(projectId), taskName: taskName ?? '' },
    skip: !envName || !projectId || !taskName,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'network-only',
  });

  const task = data?.environmentByName?.tasks?.find((t) => t?.taskName === taskName);
  const running = isActiveStatus(task?.status);

  useTaskEvents(data?.environmentByName?.id, () => void refetch());

  useEffect(() => {
    if (running) {
      startPolling(ACTIVE_POLL_MS);
      return () => stopPolling();
    }
    stopPolling();
  }, [running, startPolling, stopPolling]);

  return (
    <>
      <Stack.Screen options={{ title: task?.name ?? taskName ?? 'Task' }} />
      <View style={styles.container}>
        {error ? <EmptyState title="Could not load task" body={error.message} /> : null}
        {task ? (
          <>
            <View style={styles.header}>
              <StatusBadge status={task.status} />
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                {task.service ? `Service: ${task.service} · ` : ''}
                {durationLabel(task.started, task.completed) ?? 'not started'}
              </Text>
              {task.command ? (
                <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={2}>
                  $ {task.command}
                </Text>
              ) : null}
            </View>
            <LogViewer log={task.logs} running={running} />
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
