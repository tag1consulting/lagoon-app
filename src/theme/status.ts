/** Lagoon deployment/task status → UI color + liveness, in one place. */

const STATUS_COLORS: Record<string, string> = {
  complete: '#30a46c',
  completed: '#30a46c',
  succeeded: '#30a46c',
  successful: '#30a46c',
  active: '#30a46c',
  running: '#3b82f6',
  new: '#b58a00',
  pending: '#b58a00',
  queued: '#b58a00',
  failed: '#e5484d',
  error: '#e5484d',
  cancelled: '#8a959f',
  skipped: '#8a959f',
};

export function statusColor(status: string | null | undefined): string {
  return STATUS_COLORS[(status ?? '').toLowerCase()] ?? '#8a959f';
}

/** True while a deployment/task can still change state. */
export function isActiveStatus(status: string | null | undefined): boolean {
  return ['new', 'pending', 'queued', 'running'].includes((status ?? '').toLowerCase());
}

/** Deployments in these states can be cancelled. */
export function isCancellableStatus(status: string | null | undefined): boolean {
  return isActiveStatus(status);
}
