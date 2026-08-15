import { useQuery } from '@apollo/client/react';
import { Stack } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { Card, EmptyState } from '@/components/ui';
import { useActiveContext } from '@/contexts/store';
import { MeDocument } from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';

export default function ProjectsScreen() {
  const theme = useTheme();
  const context = useActiveContext();
  const { data, loading, error } = useQuery(MeDocument);

  return (
    <>
      <Stack.Screen options={{ title: 'Projects' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {error ? (
          <EmptyState title="Could not reach the API" body={error.message} />
        ) : (
          <Card>
            <Text style={{ color: theme.text, fontWeight: '600' }}>
              {loading && !data
                ? 'Checking connection…'
                : `Signed in as ${data?.me?.email ?? 'unknown user'}`}
            </Text>
            {context?.lagoonVersion ? (
              <Text style={{ color: theme.textMuted, marginTop: spacing.xs }}>
                Lagoon {context.lagoonVersion} at {context.graphqlUrl}
              </Text>
            ) : null}
            <Text style={{ color: theme.textMuted, marginTop: spacing.xs }}>
              Project browsing lands in the next milestone.
            </Text>
          </Card>
        )}
      </ScrollView>
    </>
  );
}
