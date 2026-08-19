import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hasFeature } from '@/api/versionGate';
import { AddEnvVariableSheet } from '@/components/AddEnvVariableSheet';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Button, EmptyState } from '@/components/ui';
import { useActiveContext } from '@/contexts/store';
import {
  DeleteEnvVariableByNameDetailedDocument,
  DeleteEnvVariableDocument,
  EnvironmentEnvVariablesDocument,
  ProjectEnvVariablesDocument,
} from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';

interface EnvVar {
  id: number | null;
  scope: string | null;
  name: string | null;
  value: string | null;
}

function EnvVariableRows({
  vars,
  loading,
  onAdd,
  onDelete,
  deleting,
}: {
  vars: EnvVar[];
  loading: boolean;
  onAdd: () => void;
  onDelete: (v: EnvVar) => void;
  deleting: boolean;
}) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<EnvVar | null>(null);

  const toggleRevealed = (name: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <View style={styles.tabBody}>
      <Button title="Add variable" onPress={onAdd} />
      {vars.length === 0 && !loading ? (
        <EmptyState title="No variables" body="No environment variables are set here yet." />
      ) : null}
      {vars.map((v) => {
        const key = v.name ?? String(v.id);
        const isRevealed = revealed.has(key);
        return (
          <View key={key} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.header}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {v.name}
              </Text>
              {v.scope ? (
                <Text style={{ color: theme.textMuted, fontSize: 11, textTransform: 'uppercase' }}>
                  {v.scope}
                </Text>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" onPress={() => toggleRevealed(key)}>
              <Text style={{ color: theme.textMuted, fontFamily: 'monospace', fontSize: 13 }}>
                {isRevealed ? (v.value ?? '') : '••••••••'}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setPendingDelete(v)}>
              <Text style={{ color: theme.danger, fontSize: 12 }}>Delete</Text>
            </Pressable>
          </View>
        );
      })}

      <ConfirmSheet
        visible={Boolean(pendingDelete)}
        title="Delete this variable?"
        message={pendingDelete?.name ? `Deletes "${pendingDelete.name}". This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete);
          setPendingDelete(null);
        }}
        onDismiss={() => setPendingDelete(null)}
      />
    </View>
  );
}

function useDeleteEnvVariable(projectName: string, environmentName?: string) {
  const context = useActiveContext();
  const byName = hasFeature(context ?? {}, 'envVariablesByName');
  const [deleteByName, { loading: deletingByName }] = useMutation(
    DeleteEnvVariableByNameDetailedDocument,
  );
  const [deleteById, { loading: deletingById }] = useMutation(DeleteEnvVariableDocument);

  const remove = async (v: EnvVar) => {
    if (byName) {
      if (!v.name) return;
      await deleteByName({
        variables: { name: v.name, project: projectName, environment: environmentName },
      });
    } else {
      if (v.id == null) return;
      await deleteById({ variables: { id: v.id } });
    }
  };

  return { remove, deleting: deletingByName || deletingById };
}

function ProjectPanel({ projectId, projectName }: { projectId: number; projectName: string }) {
  const { data, loading, error, refetch } = useQuery(ProjectEnvVariablesDocument, {
    variables: { name: projectName },
    skip: !projectName,
  });
  const [showAdd, setShowAdd] = useState(false);
  const { remove, deleting } = useDeleteEnvVariable(projectName);
  const vars = (data?.projectByName?.envVariables ?? []).filter((v): v is EnvVar => Boolean(v));

  if (error) return <EmptyState title="Could not load variables" body={error.message} />;

  return (
    <>
      <EnvVariableRows
        vars={vars}
        loading={loading}
        onAdd={() => setShowAdd(true)}
        onDelete={(v) => void remove(v).then(() => void refetch())}
        deleting={deleting}
      />
      <AddEnvVariableSheet
        visible={showAdd}
        onDismiss={() => setShowAdd(false)}
        onAdded={() => {
          setShowAdd(false);
          void refetch();
        }}
        scope="project"
        projectId={projectId}
        projectName={projectName}
      />
    </>
  );
}

function EnvironmentPanel({
  projectId,
  projectName,
  environmentId,
  environmentName,
}: {
  projectId: number;
  projectName: string;
  environmentId: number;
  environmentName: string;
}) {
  const { data, loading, error, refetch } = useQuery(EnvironmentEnvVariablesDocument, {
    variables: { name: environmentName, project: projectId },
    skip: !environmentName || !projectId,
  });
  const [showAdd, setShowAdd] = useState(false);
  const { remove, deleting } = useDeleteEnvVariable(projectName, environmentName);
  const vars = (data?.environmentByName?.envVariables ?? []).filter((v): v is EnvVar => Boolean(v));

  if (error) return <EmptyState title="Could not load variables" body={error.message} />;

  return (
    <>
      <EnvVariableRows
        vars={vars}
        loading={loading}
        onAdd={() => setShowAdd(true)}
        onDelete={(v) => void remove(v).then(() => void refetch())}
        deleting={deleting}
      />
      <AddEnvVariableSheet
        visible={showAdd}
        onDismiss={() => setShowAdd(false)}
        onAdded={() => {
          setShowAdd(false);
          void refetch();
        }}
        scope="environment"
        projectId={projectId}
        projectName={projectName}
        environmentId={environmentId}
        environmentName={environmentName}
      />
    </>
  );
}

/**
 * Project- and environment-scoped env variables are two separate lists in
 * Lagoon's API, not merged, so this picks between two internal panels that
 * each call their own query — keeping one query's variable shape from
 * leaking into the other's typing.
 */
export function EnvVariablesPanel(
  props:
    | { scope: 'project'; projectId: number; projectName: string }
    | {
        scope: 'environment';
        projectId: number;
        projectName: string;
        environmentId: number;
        environmentName: string;
      },
) {
  if (props.scope === 'environment') return <EnvironmentPanel {...props} />;
  return <ProjectPanel {...props} />;
}

const styles = StyleSheet.create({
  tabBody: {
    gap: spacing.sm,
  },
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
