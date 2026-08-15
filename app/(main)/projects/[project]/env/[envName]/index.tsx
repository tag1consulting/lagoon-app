import { useQuery } from '@apollo/client/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDeploymentEvents } from '@/api/liveUpdates';
import { DeploymentRow } from '@/components/DeploymentRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Card, EmptyState } from '@/components/ui';
import {
  EnvironmentDeploymentsDocument,
  EnvironmentInfoDocument,
  type EnvironmentInfoQuery,
} from '@/graphql/generated/graphql';
import { spacing, useTheme } from '@/theme';
import { isActiveStatus } from '@/theme/status';

/** Refetch cadence for the deployment list while any build is live. */
const ACTIVE_POLL_MS = 10_000;

function DeploymentsTab({
  project,
  envName,
  projectId,
}: {
  project: string;
  envName: string;
  projectId: string;
}) {
  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(
    EnvironmentDeploymentsDocument,
    {
      variables: { name: envName, project: Number(projectId), limit: 25 },
      fetchPolicy: 'cache-and-network',
    },
  );

  const deployments = (data?.environmentByName?.deployments ?? []).filter(
    (d): d is NonNullable<typeof d> => Boolean(d),
  );
  const anyActive = deployments.some((d) => isActiveStatus(d.status));

  // Push-based updates when the instance supports subscriptions; the poll
  // below stays as the fallback for blocked WebSockets.
  useDeploymentEvents(data?.environmentByName?.id, () => void refetch());

  useEffect(() => {
    if (anyActive) {
      startPolling(ACTIVE_POLL_MS);
      return () => stopPolling();
    }
    stopPolling();
  }, [anyActive, startPolling, stopPolling]);

  if (error) return <EmptyState title="Could not load deployments" body={error.message} />;
  if (!loading && deployments.length === 0) {
    return <EmptyState title="No deployments" body="This environment has not been deployed yet." />;
  }

  return (
    <View style={styles.tabBody}>
      {deployments.map((deployment) => (
        <DeploymentRow
          key={deployment.id ?? deployment.name}
          deployment={deployment}
          project={project}
          envName={envName}
          projectId={projectId}
        />
      ))}
    </View>
  );
}

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
          <DeploymentsTab
            project={project ?? ''}
            envName={envName ?? ''}
            projectId={projectId ?? ''}
          />
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
