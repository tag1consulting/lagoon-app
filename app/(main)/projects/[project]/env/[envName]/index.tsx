import { useLazyQuery, useMutation, useQuery } from '@apollo/client/react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useBackupEvents, useDeploymentEvents, useTaskEvents } from '@/api/liveUpdates';
import { hasFeature } from '@/api/versionGate';
import { BackupRow, type BackupSummary } from '@/components/BackupRow';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { EnvVariablesPanel } from '@/components/EnvVariablesPanel';
import { DeploymentRow, type DeploymentSummary } from '@/components/DeploymentRow';
import { RunTaskSheet } from '@/components/RunTaskSheet';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TaskRow, type TaskSummary } from '@/components/TaskRow';
import { Button, Card, EmptyState } from '@/components/ui';
import { useActiveContext } from '@/contexts/store';
import {
  DeleteBackupDocument,
  DeployLatestDocument,
  DownloadBackupLinkDetailedDocument,
  EnvironmentBackupsDetailedDocument,
  EnvironmentBackupsDocument,
  EnvironmentDeploymentsDetailedDocument,
  EnvironmentDeploymentsDocument,
  EnvironmentInfoDetailedDocument,
  EnvironmentInfoDocument,
  EnvironmentTasksDetailedDocument,
  EnvironmentTasksDocument,
  TriggerRestoreDocument,
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
  const context = useActiveContext();
  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(
    hasFeature(context ?? {}, 'deploymentDetails')
      ? EnvironmentDeploymentsDetailedDocument
      : EnvironmentDeploymentsDocument,
    {
      variables: { name: envName, project: Number(projectId), limit: 25 },
      fetchPolicy: 'cache-and-network',
    },
  );

  // The gated variant is a superset, so the row's optional fields absorb the
  // difference — they are simply absent on older instances.
  const deployments = ((data?.environmentByName?.deployments ?? []) as (DeploymentSummary | null)[])
    .filter((d): d is DeploymentSummary => Boolean(d));
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

  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployLatest, { loading: deploying }] = useMutation(DeployLatestDocument);
  const theme = useTheme();

  const environmentId = data?.environmentByName?.id;

  const handleDeploy = async () => {
    if (!environmentId) return;
    setDeployError(null);
    try {
      await deployLatest({ variables: { environment: environmentId } });
      setConfirmDeploy(false);
      void refetch();
    } catch (e) {
      setDeployError(e instanceof Error ? e.message : 'Deployment failed to start.');
    }
  };

  if (error) return <EmptyState title="Could not load deployments" body={error.message} />;

  return (
    <View style={styles.tabBody}>
      <Button
        title="Deploy latest"
        onPress={() => setConfirmDeploy(true)}
        disabled={!environmentId}
      />
      {deployments.length === 0 && !loading ? (
        <EmptyState title="No deployments" body="This environment has not been deployed yet." />
      ) : null}
      {deployments.map((deployment) => (
        <DeploymentRow
          key={deployment.id ?? deployment.name}
          deployment={deployment}
          project={project}
          envName={envName}
          projectId={projectId}
        />
      ))}

      <ConfirmSheet
        visible={confirmDeploy}
        title={`Deploy ${envName}?`}
        message={`Triggers a new build of the latest ${envName} code for ${project}.`}
        confirmLabel="Deploy latest"
        busy={deploying}
        onConfirm={() => void handleDeploy()}
        onDismiss={() => {
          setConfirmDeploy(false);
          setDeployError(null);
        }}
      >
        {deployError ? <Text style={{ color: theme.danger }}>{deployError}</Text> : null}
      </ConfirmSheet>
    </View>
  );
}

function TasksTab({
  project,
  envName,
  projectId,
}: {
  project: string;
  envName: string;
  projectId: string;
}) {
  const context = useActiveContext();
  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(
    hasFeature(context ?? {}, 'taskDetails')
      ? EnvironmentTasksDetailedDocument
      : EnvironmentTasksDocument,
    {
      variables: { name: envName, project: Number(projectId), limit: 25 },
      fetchPolicy: 'cache-and-network',
    },
  );
  const [showRunTask, setShowRunTask] = useState(false);

  const tasks = ((data?.environmentByName?.tasks ?? []) as (TaskSummary | null)[]).filter(
    (t): t is TaskSummary => Boolean(t),
  );
  const anyActive = tasks.some((t) => isActiveStatus(t.status));

  useTaskEvents(data?.environmentByName?.id, () => void refetch());

  useEffect(() => {
    if (anyActive) {
      startPolling(ACTIVE_POLL_MS);
      return () => stopPolling();
    }
    stopPolling();
  }, [anyActive, startPolling, stopPolling]);

  if (error) return <EmptyState title="Could not load tasks" body={error.message} />;

  return (
    <View style={styles.tabBody}>
      <Button
        title="Run task"
        onPress={() => setShowRunTask(true)}
        disabled={!data?.environmentByName?.id}
      />
      {tasks.length === 0 && !loading ? (
        <EmptyState title="No tasks" body="No tasks have run in this environment yet." />
      ) : null}
      {tasks.map((task) => (
        <TaskRow
          key={task.id ?? task.taskName}
          task={task}
          project={project}
          envName={envName}
          projectId={projectId}
        />
      ))}

      <RunTaskSheet
        visible={showRunTask}
        onDismiss={() => setShowRunTask(false)}
        envName={envName}
        projectId={projectId}
        environmentId={data?.environmentByName?.id}
        onStarted={(taskName) => {
          setShowRunTask(false);
          void refetch();
          if (taskName) {
            router.push({
              pathname: '/(main)/projects/[project]/env/[envName]/task/[taskName]',
              params: { project, envName, projectId, taskName },
            });
          }
        }}
      />
    </View>
  );
}

function BackupsTab({ envName, projectId }: { envName: string; projectId: string }) {
  const context = useActiveContext();
  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(
    hasFeature(context ?? {}, 'backupDownloadLink')
      ? EnvironmentBackupsDetailedDocument
      : EnvironmentBackupsDocument,
    {
      variables: { name: envName, project: Number(projectId), limit: 25 },
      fetchPolicy: 'cache-and-network',
    },
  );

  const backups = ((data?.environmentByName?.backups ?? []) as (BackupSummary | null)[]).filter(
    (b): b is BackupSummary => Boolean(b),
  );
  const anyActive = backups.some((b) => isActiveStatus(b.restore?.status));

  useBackupEvents(data?.environmentByName?.id, () => void refetch());

  useEffect(() => {
    if (anyActive) {
      startPolling(ACTIVE_POLL_MS);
      return () => stopPolling();
    }
    stopPolling();
  }, [anyActive, startPolling, stopPolling]);

  const [selectedBackup, setSelectedBackup] = useState<BackupSummary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BackupSummary | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [triggerRestore, { loading: restoring }] = useMutation(TriggerRestoreDocument);
  const [deleteBackup, { loading: deleting }] = useMutation(DeleteBackupDocument);
  const [fetchDownloadLink] = useLazyQuery(DownloadBackupLinkDetailedDocument);
  const theme = useTheme();
  const canDownload = hasFeature(context ?? {}, 'backupDownloadLink');

  const handleRestore = async () => {
    if (!selectedBackup?.backupId) return;
    setRestoreError(null);
    try {
      await triggerRestore({ variables: { backupId: selectedBackup.backupId } });
      setSelectedBackup(null);
      void refetch();
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : 'Restore failed to start.');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete?.backupId) return;
    setDeleteError(null);
    try {
      await deleteBackup({ variables: { backupId: pendingDelete.backupId } });
      setPendingDelete(null);
      void refetch();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete backup.');
    }
  };

  const handleDownload = async (backupId: string) => {
    try {
      const result = await fetchDownloadLink({ variables: { backupId } });
      const url = result.data?.getBackupDownloadLinkByBackupId;
      if (!url) throw new Error('No download link is available for this backup.');
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      Alert.alert(
        'Could not get download link',
        e instanceof Error ? e.message : 'Something went wrong.',
      );
    }
  };

  if (error) return <EmptyState title="Could not load backups" body={error.message} />;

  return (
    <View style={styles.tabBody}>
      {backups.length === 0 && !loading ? (
        <EmptyState title="No backups" body="This environment has no backups yet." />
      ) : null}
      {backups.map((backup) => (
        <BackupRow
          key={backup.id ?? backup.backupId}
          backup={backup}
          onRestore={() => setSelectedBackup(backup)}
          onDelete={() => setPendingDelete(backup)}
          onDownload={
            canDownload && backup.backupId ? () => void handleDownload(backup.backupId!) : undefined
          }
        />
      ))}

      <ConfirmSheet
        visible={Boolean(selectedBackup)}
        title="Restore this backup?"
        message={`This overwrites the current data in ${envName} with the ${selectedBackup?.created ?? 'selected'} backup.`}
        confirmLabel="Restore"
        destructive
        busy={restoring}
        onConfirm={() => void handleRestore()}
        onDismiss={() => {
          setSelectedBackup(null);
          setRestoreError(null);
        }}
      >
        {restoreError ? <Text style={{ color: theme.danger }}>{restoreError}</Text> : null}
      </ConfirmSheet>

      <ConfirmSheet
        visible={Boolean(pendingDelete)}
        title="Delete this backup?"
        message="This removes the backup record. This cannot be undone."
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onDismiss={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
      >
        {deleteError ? <Text style={{ color: theme.danger }}>{deleteError}</Text> : null}
      </ConfirmSheet>
    </View>
  );
}

const TABS = ['Deployments', 'Tasks', 'Backups', 'Variables', 'Info'] as const;
type Tab = (typeof TABS)[number];

/**
 * Base shape plus the fields the gated variant adds — services carry `type`
 * only on instances new enough to expose it.
 */
type EnvInfo = Omit<NonNullable<EnvironmentInfoQuery['environmentByName']>, 'services'> & {
  services?: ({ id?: number | null; name?: string | null; type?: string | null } | null)[] | null;
};

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
            <Pressable
              key={route}
              accessibilityRole="link"
              onPress={() => void WebBrowser.openBrowserAsync(/^https?:\/\//.test(route) ? route : `https://${route}`)}
            >
              <Text style={{ color: theme.primary, fontSize: 13 }} numberOfLines={1}>
                {route}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {services.length > 0 ? (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Services</Text>
          {services.map((service) => (
            <Text key={service?.id ?? service?.name} style={{ color: theme.textMuted, fontSize: 13 }}>
              {service?.name}
              {service?.type ? ` (${service.type})` : ''}
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

  const context = useActiveContext();
  const { data, loading, error, refetch } = useQuery(
    hasFeature(context ?? {}, 'serviceDetails')
      ? EnvironmentInfoDetailedDocument
      : EnvironmentInfoDocument,
    {
      variables: { name: envName ?? '', project: Number(projectId) },
      skip: !envName || !projectId,
    },
  );

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
          <TasksTab project={project ?? ''} envName={envName ?? ''} projectId={projectId ?? ''} />
        ) : null}
        {tab === 'Backups' ? (
          <BackupsTab envName={envName ?? ''} projectId={projectId ?? ''} />
        ) : null}
        {tab === 'Variables' && env?.id ? (
          <EnvVariablesPanel
            scope="environment"
            projectId={Number(projectId)}
            projectName={project ?? ''}
            environmentId={env.id}
            environmentName={envName ?? ''}
          />
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
