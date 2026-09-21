import type { EngineConnectionManager } from '#modules/engine-core';

/** Timer Start Event schedule (REST `/timer-schedules` — not yet on BfwEngineClient). */
export interface TimerSchedule {
  id: string;
  processModelId: string;
  processVersionId: string;
  flowNodeId: string;
  kind: 'cycle' | 'date' | 'duration';
  isoSpec: string;
  enabled: boolean;
  nextFireAt: string | null;
  lastTriggeredAt?: string | null;
}

async function authorizedFetch(
  connectionManager: EngineConnectionManager,
  engineId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const connection = connectionManager.getConnection(engineId);
  if (!connection) {
    throw new Error('Not connected');
  }

  const token = connectionManager.identity.getToken(connection.url);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${connection.url.replace(/\/$/, '')}${path}`;
  return fetch(url, { ...init, headers });
}

export async function fetchTimerSchedules(
  connectionManager: EngineConnectionManager,
  engineId: string,
): Promise<TimerSchedule[]> {
  const response = await authorizedFetch(connectionManager, engineId, '/timer-schedules');
  if (!response.ok) {
    throw new Error(`Failed to load timer schedules (${response.status})`);
  }
  const body = (await response.json()) as { data: TimerSchedule[] };
  return body.data ?? [];
}

export async function enableTimerSchedule(
  connectionManager: EngineConnectionManager,
  engineId: string,
  scheduleId: string,
): Promise<TimerSchedule> {
  const response = await authorizedFetch(connectionManager, engineId, `/timer-schedules/${scheduleId}/enable`, {
    method: 'PUT',
  });
  if (!response.ok) {
    throw new Error(`Failed to enable timer schedule (${response.status})`);
  }
  const body = (await response.json()) as { data: TimerSchedule };
  return body.data;
}

export async function disableTimerSchedule(
  connectionManager: EngineConnectionManager,
  engineId: string,
  scheduleId: string,
): Promise<TimerSchedule> {
  const response = await authorizedFetch(connectionManager, engineId, `/timer-schedules/${scheduleId}/disable`, {
    method: 'PUT',
  });
  if (!response.ok) {
    throw new Error(`Failed to disable timer schedule (${response.status})`);
  }
  const body = (await response.json()) as { data: TimerSchedule };
  return body.data;
}
