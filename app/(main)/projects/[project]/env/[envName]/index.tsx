import { useQuery } from '@apollo/client/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { Card, EmptyState } from '@/components/ui';
import { EnvironmentInfoDocument, type EnvironmentInfoQuery } from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';

const TABS = ['Deployments', 'Tasks', 'Info'] as const;
type Tab = (typeof TABS)[number];

type EnvInfo = NonNullable<EnvironmentInfoQuery['environmentByName']>;

function InfoTab({ env }: { env: EnvInfo }) {
  const theme = useTheme();
  const routes = (env.routes ?? '').split(',').filter(Boolean);
  const services = (env.services ?? []).filter(Boolean);
  const facts = (env.facts ?? []).filter(Boolean);

  return (
    <View style={styles.tabBody}>
      <Card>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Environment</Text>
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
          Type: {env.environmentType} · Deploy: {env.deployType}
          {env.deployBaseRef ? ` (${env.deployBaseRef})` : ''}
        </Text>
        {env.openshiftProjectName ? (
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>
            Namespace: {env.openshiftProjectName}
          </Text>
        ) : null}
        {env.updated ? (
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>Updated: {env.updated}</Text>
        ) : null}
      </Card>

      {routes.length > 0 ? (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Routes</Text>
          {routes.map((route) => (
            <Text key={route} style={{ color: theme.textMuted, fontSize: 13 }} numberOfLines={1}>
              {route}
            </Text>
          ))}
        </Card>
      ) : null}

      {services.length > 0 ? (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Services</Text>
          {services.map((service) => (
            <Text key={service?.id ?? service?.name} style={{ color: theme.textMuted, fontSize: 13 }}>
              {service?.name} ({service?.type}
              {service?.replicas != null ? ` ×${service.replicas}` : ''})
            </Text>
          ))}
        </Card>
      ) : null}

      {facts.length > 0 ? (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Key facts</Text>
          {facts.map((fact) => (
            <Text key={fact?.id} style={{ color: theme.textMuted, fontSize: 13 }}>
              {fact?.name}: {fact?.value}
              {fact?.service ? ` (${fact.service})` : ''}
            </Text>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

export default function EnvironmentScreen() {
  const { project, envName, projectId } = useLocalSearchParams<{
    project: string;
    envName: string;
    projectId: string;
  }>();
  const [tab, setTab] = useState<Tab>('Deployments');

  const { data, loading, error, refetch } = useQuery(EnvironmentInfoDocument, {
    variables: { name: envName ?? '', project: Number(projectId) },
    skip: !envName || !projectId,
  });

  const env = data?.environmentByName;

  return (
    <>
      <Stack.Screen options={{ title: `${project} / ${envName}` }} />
      <SegmentedControl segments={TABS} value={tab} onChange={setTab} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refetch()} />}
      >
        {error ? <EmptyState title="Could not load environment" body={error.message} /> : null}
        {env && tab === 'Info' ? <InfoTab env={env} /> : null}
        {tab === 'Deployments' ? (
          <EmptyState title="Deployments" body="Deployment history lands in the next milestone." />
        ) : null}
        {tab === 'Tasks' ? (
          <EmptyState title="Tasks" body="Task history lands in a later milestone." />
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  tabBody: {
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
});
