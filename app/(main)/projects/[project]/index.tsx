import { useQuery } from '@apollo/client/react';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { ProjectByNameDocument, type ProjectByNameQuery } from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';

type ProjectEnv = NonNullable<
  NonNullable<NonNullable<ProjectByNameQuery['projectByName']>['environments']>[number]
>;

function EnvironmentCard({
  env,
  projectName,
  projectId,
}: {
  env: ProjectEnv;
  projectName: string;
  projectId: number;
}) {
  const theme = useTheme();
  const production = env.environmentType === 'production';

  return (
    <Link
      href={{
        pathname: '/(main)/projects/[project]/env/[envName]',
        params: { project: projectName, envName: env.name ?? '', projectId: String(projectId) },
      }}
      asChild
    >
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: production ? theme.primary : theme.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardName, { color: theme.text }]}>{env.name}</Text>
          <Text
            style={{
              color: production ? theme.primary : theme.textMuted,
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
            }}
          >
            {env.environmentType}
          </Text>
        </View>
        {env.route ? (
          <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
            {env.route}
          </Text>
        ) : null}
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
          {env.deployType} deploy
          {env.updated ? ` · updated ${env.updated}` : ''}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function ProjectScreen() {
  const theme = useTheme();
  const { project } = useLocalSearchParams<{ project: string }>();
  const { data, loading, error, refetch } = useQuery(ProjectByNameDocument, {
    variables: { name: project ?? '' },
    skip: !project,
  });

  const proj = data?.projectByName;
  const environments = (proj?.environments ?? []).filter((e): e is ProjectEnv => Boolean(e));
  const production = environments.filter((e) => e.environmentType === 'production');
  const development = environments.filter((e) => e.environmentType !== 'production');

  return (
    <>
      <Stack.Screen
        options={{
          title: project ?? 'Project',
          headerRight: () => (
            <Link
              href={{
                pathname: '/(main)/projects/[project]/variables',
                params: { project: project ?? '', projectId: String(proj?.id ?? 0) },
              }}
            >
              <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>
                Variables
              </Text>
            </Link>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refetch()} />}
      >
        {error ? <EmptyState title="Could not load project" body={error.message} /> : null}
        {proj?.gitUrl ? (
          <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
            {proj.gitUrl}
          </Text>
        ) : null}

        {production.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Production</Text>
            {production.map((env) => (
              <EnvironmentCard
                key={env.id}
                env={env}
                projectName={project ?? ''}
                projectId={proj?.id ?? 0}
              />
            ))}
          </>
        ) : null}

        {development.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Development</Text>
            {development.map((env) => (
              <EnvironmentCard
                key={env.id}
                env={env}
                projectName={project ?? ''}
                projectId={proj?.id ?? 0}
              />
            ))}
          </>
        ) : null}

        {!loading && !error && environments.length === 0 ? (
          <EmptyState title="No environments" body="This project has no environments yet." />
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
  },
});
