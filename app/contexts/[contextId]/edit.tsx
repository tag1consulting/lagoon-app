import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { ContextForm } from '@/components/ContextForm';
import { EmptyState } from '@/components/ui';
import { useContextsStore } from '@/contexts/store';

export default function EditContextScreen() {
  const { contextId } = useLocalSearchParams<{ contextId: string }>();
  const context = useContextsStore((s) => s.contexts.find((c) => c.id === contextId));
  const updateContext = useContextsStore((s) => s.updateContext);
  const removeContext = useContextsStore((s) => s.removeContext);

  if (!context) {
    return <EmptyState title="Context not found" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: `Edit ${context.name}` }} />
      <ContextForm
        initial={context}
        submitLabel="Save changes"
        onSubmit={(input) => {
          updateContext(context.id, input);
          router.back();
        }}
        onDelete={() => {
          Alert.alert(
            'Delete context?',
            `Remove "${context.name}" and its saved login from this device.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  removeContext(context.id);
                  router.dismissTo('/');
                },
              },
            ],
          );
        }}
      />
    </>
  );
}
