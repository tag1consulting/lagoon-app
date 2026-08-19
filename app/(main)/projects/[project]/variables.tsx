import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { EnvVariablesPanel } from '@/components/EnvVariablesPanel';
import { spacing } from '@/theme';

export default function ProjectVariablesScreen() {
  const { project, projectId } = useLocalSearchParams<{ project: string; projectId: string }>();

  return (
    <>
      <Stack.Screen options={{ title: `${project ?? 'Project'} / Variables` }} />
      <ScrollView contentContainerStyle={styles.container}>
        <EnvVariablesPanel
          scope="project"
          projectId={Number(projectId)}
          projectName={project ?? ''}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
});
