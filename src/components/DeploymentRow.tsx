import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/components/StatusBadge';
import { spacing, useTheme } from '@/theme';

export interface DeploymentSummary {
  id?: number | null;
  name?: string | null;
  status?: string | null;
  created?: string | null;
  started?: string | null;
  completed?: string | null;
  buildStep?: string | null;
  sourceUser?: string | null;
}

export function durationLabel(
  started: string | null | undefined,
  completed: string | null | undefined,
): string | null {
  if (!started) return null;
  const start = Date.parse(started);
  const end = completed ? Date.parse(completed) : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function DeploymentRow({
  deployment,
  project,
  envName,
  projectId,
}: {
  deployment: DeploymentSummary;
  project: string;
  envName: string;
  projectId: string;
}) {
  const theme = useTheme();

  return (
    <Link
      href={{
        pathname: '/(main)/projects/[project]/env/[envName]/deployment/[deploymentName]',
        params: { project, envName, projectId, deploymentName: deployment.name ?? '' },
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
          <Text style={[styles.name, { color: theme.text }]}>{deployment.name}</Text>
          <StatusBadge status={deployment.status} />
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
          {deployment.created ?? ''}
          {deployment.sourceUser ? ` · by ${deployment.sourceUser}` : ''}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
          {deployment.buildStep ? `Step: ${deployment.buildStep} · ` : ''}
          {durationLabel(deployment.started, deployment.completed) ?? 'not started'}
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
