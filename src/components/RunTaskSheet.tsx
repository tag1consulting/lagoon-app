import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Field } from '@/components/ui';
import { hasFeature } from '@/api/versionGate';
import { useActiveContext } from '@/contexts/store';
import {
  AddTaskDocument,
  EnvironmentAdvancedTasksDetailedDocument,
  EnvironmentAdvancedTasksDocument,
  InvokeRegisteredTaskDocument,
  type EnvironmentAdvancedTasksQuery,
} from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';

type TaskArgument = {
  id?: number | null;
  name?: string | null;
  displayName?: string | null;
  type?: string | null;
  range?: (string | null)[] | null;
  /** Only queryable on instances with the taskArgumentMetadata feature. */
  defaultValue?: string | null;
  optional?: boolean | null;
};

type AdvancedTask = Omit<
  NonNullable<
    NonNullable<
      NonNullable<EnvironmentAdvancedTasksQuery['environmentByName']>['advancedTasks']
    >[number]
  >,
  'advancedTaskDefinitionArguments'
> & { advancedTaskDefinitionArguments?: (TaskArgument | null)[] | null };

function taskArguments(task: AdvancedTask): TaskArgument[] {
  return (task.advancedTaskDefinitionArguments ?? []).filter((a): a is TaskArgument => Boolean(a));
}

export function RunTaskSheet({
  visible,
  onDismiss,
  onStarted,
  envName,
  projectId,
  environmentId,
}: {
  visible: boolean;
  onDismiss: () => void;
  /** Called with the started task's taskName (when the API returns one). */
  onStarted: (taskName: string | null) => void;
  envName: string;
  projectId: string;
  environmentId: number | null | undefined;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<AdvancedTask | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [showCustom, setShowCustom] = useState(false);
  const [customService, setCustomService] = useState('cli');
  const [customCommand, setCustomCommand] = useState('');
  const [error, setError] = useState<string | null>(null);

  const context = useActiveContext();
  // Argument defaults and required-ness are only queryable on newer instances.
  const hasArgumentMetadata = hasFeature(context ?? {}, 'taskArgumentMetadata');
  const { data, loading } = useQuery(
    hasArgumentMetadata
      ? EnvironmentAdvancedTasksDetailedDocument
      : EnvironmentAdvancedTasksDocument,
    {
      variables: { name: envName, project: Number(projectId) },
      skip: !visible || !envName || !projectId,
    },
  );

  const [invokeTask, { loading: invoking }] = useMutation(InvokeRegisteredTaskDocument);
  const [addTask, { loading: adding }] = useMutation(AddTaskDocument);
  const busy = invoking || adding;

  // One cast at the boundary: the gated variant returns a superset, and
  // AdvancedTask models the extra argument metadata as optional.
  const tasks = ((data?.environmentByName?.advancedTasks ?? []) as (AdvancedTask | null)[]).filter(
    (t): t is AdvancedTask => Boolean(t),
  );

  const reset = () => {
    setSelected(null);
    setArgValues({});
    setShowCustom(false);
    setCustomCommand('');
    setError(null);
  };

  const dismiss = () => {
    reset();
    onDismiss();
  };

  const runRegistered = async () => {
    if (!selected?.id || !environmentId) return;
    const args = taskArguments(selected);
    // Required-ness is only known when the instance exposes `optional`;
    // otherwise send what the user supplied and let the API reject it.
    if (hasArgumentMetadata) {
      const missing = args.filter(
        (a) => !a.optional && !(argValues[a.name ?? ''] ?? a.defaultValue),
      );
      if (missing.length > 0) {
        setError(`Missing required argument: ${missing[0].displayName ?? missing[0].name}`);
        return;
      }
    }
    setError(null);
    try {
      const result = await invokeTask({
        variables: {
          advancedTaskDefinition: selected.id,
          environment: environmentId,
          argumentValues: args
            .map((a) => ({
              advancedTaskDefinitionArgumentName: a.name,
              value: argValues[a.name ?? ''] ?? a.defaultValue ?? '',
            }))
            .filter((a) => a.value !== ''),
        },
      });
      reset();
      onStarted(result.data?.invokeRegisteredTask?.taskName ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Task failed to start.');
    }
  };

  const runCustom = async () => {
    if (!environmentId || !customCommand.trim()) return;
    setError(null);
    try {
      const result = await addTask({
        variables: {
          name: 'Custom command (mobile)',
          environment: environmentId,
          service: customService.trim() || 'cli',
          command: customCommand.trim(),
        },
      });
      reset();
      onStarted(result.data?.addTask?.taskName ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Task failed to start.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityRole="button">
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: theme.text }]}>Run a task</Text>

            {!selected && !showCustom ? (
              <>
                {loading ? (
                  <Text style={{ color: theme.textMuted }}>Loading registered tasks…</Text>
                ) : tasks.length === 0 ? (
                  <Text style={{ color: theme.textMuted }}>
                    No registered tasks for this environment.
                  </Text>
                ) : (
                  tasks.map((task) => (
                    <Pressable
                      key={task.id}
                      accessibilityRole="button"
                      onPress={() => setSelected(task)}
                      style={({ pressed }) => [
                        styles.taskOption,
                        { borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Text style={{ color: theme.text, fontWeight: '600' }}>{task.name}</Text>
                      {task.description ? (
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                          {task.description}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))
                )}
                <Pressable accessibilityRole="button" onPress={() => setShowCustom(true)}>
                  <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                    Advanced: run a custom command…
                  </Text>
                </Pressable>
              </>
            ) : null}

            {selected ? (
              <>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{selected.name}</Text>
                {selected.confirmationText ? (
                  <Text style={{ color: theme.danger }}>{selected.confirmationText}</Text>
                ) : null}
                {taskArguments(selected).map((arg) => (
                  <Field
                    key={arg.id ?? arg.name}
                    label={`${arg.displayName ?? arg.name ?? ''}${arg.optional ? ' (optional)' : ''}`}
                    hint={arg.range?.length ? `One of: ${arg.range.join(', ')}` : undefined}
                    placeholder={arg.defaultValue ?? ''}
                    value={argValues[arg.name ?? ''] ?? ''}
                    onChangeText={(v) => setArgValues((prev) => ({ ...prev, [arg.name ?? '']: v }))}
                  />
                ))}
                <Button title="Run task" onPress={() => void runRegistered()} loading={busy} />
                <Button title="Back" variant="secondary" onPress={reset} disabled={busy} />
              </>
            ) : null}

            {showCustom ? (
              <>
                <Text style={{ color: theme.danger }}>
                  This runs an arbitrary command in the environment. Make sure you know exactly
                  what it does.
                </Text>
                <Field
                  label="Service"
                  placeholder="cli"
                  value={customService}
                  onChangeText={setCustomService}
                />
                <Field
                  label="Command"
                  placeholder="drush status"
                  value={customCommand}
                  onChangeText={setCustomCommand}
                />
                <Button
                  title="Run command"
                  variant="danger"
                  onPress={() => void runCustom()}
                  loading={busy}
                  disabled={!customCommand.trim()}
                />
                <Button title="Back" variant="secondary" onPress={reset} disabled={busy} />
              </>
            ) : null}

            {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
            {!selected && !showCustom ? (
              <Button title="Close" variant="secondary" onPress={dismiss} />
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: '85%',
    padding: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  taskOption: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
    padding: spacing.md,
  },
});
