import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { durationLabel } from '@/components/DeploymentRow';
import { StatusBadge } from '@/components/StatusBadge';
import { spacing, useTheme } from '@/theme';

export interface TaskSummary {
  id?: number | null;
  taskName?: string | null;
  name?: string | null;
  status?: string | null;
  created?: string | null;
  started?: string | null;
  completed?: string | null;
  service?: string | null;
  sourceUser?: string | null;
}

export function TaskRow({
  task,
  project,
  envName,
  projectId,
}: {
  task: TaskSummary;
  project: string;
  envName: string;
  projectId: string;
}) {
  const theme = useTheme();

  return (
    <Link
      href={{
        pathname: '/(main)/projects/[project]/env/[envName]/task/[taskName]',
        params: { project, envName, projectId, taskName: task.taskName ?? '' },
      }}
      asChild
    >
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {task.name ?? task.taskName}
          </Text>
          <StatusBadge status={task.status} />
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
          {task.created ?? ''}
          {task.service ? ` · ${task.service}` : ''}
          {task.sourceUser ? ` · by ${task.sourceUser}` : ''}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
          {durationLabel(task.started, task.completed) ?? 'not started'}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
