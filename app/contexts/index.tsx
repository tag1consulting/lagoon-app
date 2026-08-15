import { Link, Stack, router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { useContextsStore } from '@/contexts/store';
import type { LagoonContext } from '@/contexts/types';
import { spacing, useTheme } from '@/theme';

function ContextRow({ context, active }: { context: LagoonContext; active: boolean }) {
  const theme = useTheme();
  const setActiveContext = useContextsStore((s) => s.setActiveContext);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        setActiveContext(context.id);
        router.back();
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surface,
          borderColor: active ? theme.primary : theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: theme.text }]}>
          {context.name}
          {active ? '  ✓' : ''}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
          {context.graphqlUrl}
        </Text>
        {context.lagoonVersion ? (
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>
            Lagoon {context.lagoonVersion}
          </Text>
        ) : null}
      </View>
      <Link href={{ pathname: '/contexts/[contextId]/edit', params: { contextId: context.id } }}>
        <Text style={{ color: theme.primary, fontWeight: '600' }}>Edit</Text>
      </Link>
    </Pressable>
  );
}

export default function ContextsScreen() {
  const theme = useTheme();
  const contexts = useContextsStore((s) => s.contexts);
  const activeContextId = useContextsStore((s) => s.activeContextId);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Lagoon contexts',
          headerLeft: () => (
            <Link href="/settings">
              <Text style={{ color: theme.primary, fontSize: 16 }}>Settings</Text>
            </Link>
          ),
          headerRight: () => (
            <Link href="/contexts/add">
              <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>Add</Text>
            </Link>
          ),
        }}
      />
      <FlatList
        data={contexts}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ContextRow context={item} active={item.id === activeContextId} />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No contexts yet"
            body="Add a Lagoon instance to get started — you just need its GraphQL API URL."
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  row: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
  },
});
