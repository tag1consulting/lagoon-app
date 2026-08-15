import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

/**
 * Confirmation gate for every mutating action (deploys, cancels, tasks).
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onDismiss,
  children,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  children?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button">
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {message ? <Text style={{ color: theme.textMuted }}>{message}</Text> : null}
          {children}
          <Button
            title={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            onPress={onConfirm}
            loading={busy}
          />
          <Button title="Cancel" variant="secondary" onPress={onDismiss} disabled={busy} />
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
});
