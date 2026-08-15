import { Stack, router } from 'expo-router';

import { ContextForm } from '@/components/ContextForm';
import { useContextsStore } from '@/contexts/store';

export default function AddContextScreen() {
  const addContext = useContextsStore((s) => s.addContext);
  const setActiveContext = useContextsStore((s) => s.setActiveContext);

  return (
    <>
      <Stack.Screen options={{ title: 'Add context' }} />
      <ContextForm
        submitLabel="Add context"
        onSubmit={(input) => {
          const context = addContext(input);
          setActiveContext(context.id);
          router.dismissTo('/');
        }}
      />
    </>
  );
}
