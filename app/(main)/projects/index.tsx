import { useQuery } from '@apollo/client/react';
import { FlashList } from '@shopify/flash-list';
import { Link, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { AllProjectsDocument, type AllProjectsQuery } from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';

type Project = NonNullable<NonNullable<AllProjectsQuery['allProjects']>[number]>;

function ProjectRow({ project }: { project: Project }) {
  const theme = useTheme();
  const envCount = project.environments?.filter(Boolean).length ?? 0;
  const prodCount =
    project.environments?.filter((e) => e?.environmentType === 'production').length ?? 0;

  return (
    <Link
      href={{ pathname: '/(main)/projects/[project]', params: { project: project.name ?? '' } }}
      asChild
    >
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[styles.rowName, { color: theme.text }]}>{project.name}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
          {envCount} environment{envCount === 1 ? '' : 's'}
          {prodCount > 0 ? ` · ${prodCount} production` : ''}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function ProjectsScreen() {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const { data, loading, error, refetch } = useQuery(AllProjectsDocument);

  const projects = useMemo(() => {
    const all = (data?.allProjects ?? []).filter((p): p is Project => Boolean(p));
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? all.filter((p) => (p.name ?? '').toLowerCase().includes(needle))
      : all;
    return [...filtered].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [data, search]);

  return (
    <>
      <Stack.Screen options={{ title: 'Projects' }} />
      <View style={styles.container}>
        <TextInput
          placeholder="Search projects"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          value={search}
          onChangeText={setSearch}
          style={[
            styles.search,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
          ]}
        />
        <FlashList
          data={projects}
          keyExtractor={(p) => String(p.id ?? p.name)}
          renderItem={({ item }) => <ProjectRow project={item} />}
          contentContainerStyle={{ padding: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void refetch()} />
          }
          ListEmptyComponent={
            error ? (
              <EmptyState title="Could not load projects" body={error.message} />
            ) : loading ? null : (
              <EmptyState
                title={search ? 'No matching projects' : 'No projects'}
                body={
                  search
                    ? 'Try a different search.'
                    : 'Your account has no projects on this Lagoon instance.'
                }
              />
            )
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  search: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  row: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    padding: spacing.md,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
  },
});
