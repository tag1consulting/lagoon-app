import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/components/StatusBadge';
import { spacing, useTheme } from '@/theme';

export interface BackupSummary {
  id?: number | null;
  backupId?: string | null;
  source?: string | null;
  created?: string | null;
  restore?: {
    id?: number | null;
    status?: string | null;
    restoreLocation?: string | null;
    created?: string | null;
    /** Only queryable on instances with the backupDownloadLink feature. */
    restoreSize?: number | null;
  } | null;
}

/**
 * No detail route: unlike deployments/tasks there's no log to view, so
 * tapping the summary line goes straight to the parent's restore
 * confirmation. Delete/download are separate touch targets below rather
 * than nested inside that same Pressable.
 */
export function BackupRow({
  backup,
  onRestore,
  onDelete,
  onDownload,
}: {
  backup: BackupSummary;
  onRestore: () => void;
  onDelete: () => void;
  /** Omit to hide the action (e.g. instance doesn't support backupDownloadLink). */
  onDownload?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable accessibilityRole="button" onPress={onRestore} style={styles.summary}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {backup.created ?? backup.backupId}
          </Text>
          {backup.restore ? <StatusBadge status={backup.restore.status} /> : null}
        </View>
        {backup.source ? (
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>Source: {backup.source}</Text>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
        {onDownload ? (
          <Pressable accessibilityRole="button" onPress={onDownload}>
            <Text style={{ color: theme.primary, fontSize: 12 }}>Download</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onDelete}>
          <Text style={{ color: theme.danger, fontSize: 12 }}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  summary: {
    gap: 4,
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
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
});
