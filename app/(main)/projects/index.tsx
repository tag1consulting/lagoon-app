import { Stack } from 'expo-router';

import { EmptyState } from '@/components/ui';

export default function ProjectsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Projects' }} />
      <EmptyState title="Signed in" body="Project browsing lands in the next milestone." />
    </>
  );
}
