import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { hasFeature } from '@/api/versionGate';
import { Button, Field } from '@/components/ui';
import { useActiveContext } from '@/contexts/store';
import {
  AddEnvVariableByNameDetailedDocument,
  AddEnvVariableDocument,
  type EnvVariableScope,
} from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';

const SCOPES: EnvVariableScope[] = [
  'BUILD',
  'RUNTIME',
  'GLOBAL',
  'CONTAINER_REGISTRY',
  'INTERNAL_CONTAINER_REGISTRY',
];

/**
 * Add a project- or environment-scoped env variable. Which mutation runs
 * depends on the instance: the by-name API (>=2.11) takes project/environment
 * by name, the deprecated by-id fallback (2.8-2.10) needs the numeric id of
 * whichever entity the variable is scoped to.
 */
export function AddEnvVariableSheet({
  visible,
  onDismiss,
  onAdded,
  scope,
  projectId,
  projectName,
  environmentId,
  environmentName,
}: {
  visible: boolean;
  onDismiss: () => void;
  onAdded: () => void;
  scope: 'project' | 'environment';
  projectId: number;
  projectName: string;
  environmentId?: number;
  environmentName?: string;
}) {
  const theme = useTheme();
  const context = useActiveContext();
  const byName = hasFeature(context ?? {}, 'envVariablesByName');

  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [varScope, setVarScope] = useState<EnvVariableScope>('RUNTIME');
  const [error, setError] = useState<string | null>(null);

  const [addByName, { loading: addingByName }] = useMutation(AddEnvVariableByNameDetailedDocument);
  const [addById, { loading: addingById }] = useMutation(AddEnvVariableDocument);
  const busy = addingByName || addingById;

  const reset = () => {
    setName('');
    setValue('');
    setVarScope('RUNTIME');
    setError(null);
  };

  const dismiss = () => {
    reset();
    onDismiss();
  };

  const handleAdd = async () => {
    if (!name.trim() || !value) return;
    setError(null);
    try {
      if (byName) {
        await addByName({
          variables: {
            name: name.trim(),
            value,
            scope: varScope,
            project: projectName,
            environment: scope === 'environment' ? environmentName : undefined,
          },
        });
      } else {
        await addById({
          variables: {
            type: scope === 'environment' ? 'ENVIRONMENT' : 'PROJECT',
            typeId: scope === 'environment' ? (environmentId ?? 0) : projectId,
            scope: varScope,
            name: name.trim(),
            value,
          },
        });
      }
      reset();
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add variable.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityRole="button">
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.text }]}>Add variable</Text>
          <Field label="Name" placeholder="MY_VARIABLE" value={name} onChangeText={setName} />
          <Field
            label="Value"
            placeholder="value"
            value={value}
            onChangeText={setValue}
            secureTextEntry
          />
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>Scope</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const i = SCOPES.indexOf(varScope);
              setVarScope(SCOPES[(i + 1) % SCOPES.length]);
            }}
            style={[styles.scopePicker, { borderColor: theme.border }]}
          >
            <Text style={{ color: theme.text }}>{varScope}</Text>
          </Pressable>

          {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

          <Button
            title="Add"
            onPress={() => void handleAdd()}
            loading={busy}
            disabled={!name.trim() || !value}
          />
          <Button title="Cancel" variant="secondary" onPress={dismiss} disabled={busy} />
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
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  scopePicker: {
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.sm,
  },
});
