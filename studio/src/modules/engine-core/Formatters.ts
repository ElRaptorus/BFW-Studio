import type { EventDefinitionType, FlowNodeType } from '@elraptorus/daemonengine_sdk';
import dayjs from 'dayjs';

export function getEngineLabel(engineUrl: string, engineName?: string, connected?: boolean): string {
  const prefix = connected === false ? '[OFFLINE] \u2022 ' : '';
  const trimmedEngineName = engineName == null || engineName.trim() === '' ? '' : `${engineName.trim()} \u2022 `;
  const shortEngineUrl = engineUrl.replace(/^(https?:\/\/)/, '');

  return `${prefix}${trimmedEngineName}${shortEngineUrl}`;
}

export function getEventTypeText(eventType?: EventDefinitionType | null): string {
  if (!eventType) {
    return 'None';
  }

  const labels: Record<string, string> = {
    message: 'Message',
    signal: 'Signal',
    timer: 'Timer',
    error: 'Error',
    escalation: 'Escalation',
    conditional: 'Conditional',
    compensation: 'Compensation',
    terminate: 'Terminate',
    cancel: 'Cancel',
    link: 'Link',
  };

  return labels[eventType] ?? eventType;
}

export function getFlowNodeTypeText(flowNodeType: FlowNodeType): string {
  const labels: Record<string, string> = {
    start_event: 'Start Event',
    end_event: 'End Event',
    intermediate_catch_event: 'Intermediate Catch Event',
    intermediate_throw_event: 'Intermediate Throw Event',
    boundary_event: 'Boundary Event',
    task: 'Task',
    user_task: 'User Task',
    service_task: 'Service Task',
    manual_task: 'Manual Task',
    script_task: 'Script Task',
    business_rule_task: 'Business Rule Task',
    send_task: 'Send Task',
    receive_task: 'Receive Task',
    call_activity: 'Call Activity',
    sub_process: 'Sub Process',
    exclusive_gateway: 'Exclusive Gateway',
    parallel_gateway: 'Parallel Gateway',
    inclusive_gateway: 'Inclusive Gateway',
    event_based_gateway: 'Event-Based Gateway',
    complex_gateway: 'Complex Gateway',
  };

  return labels[flowNodeType] ?? flowNodeType;
}

export function getShortId(id: string | undefined | null): string {
  if (!id) {
    return '';
  }
  const match = id.match(/^([^-]+)/);
  return match?.[1] ?? id;
}

export function getHumanizedTimeAndOmitDateForToday(date: string | Date | undefined | null): string {
  if (!date) {
    return '';
  }
  const parsed = dayjs(date);
  if (!parsed.isValid()) {
    return String(date);
  }

  if (parsed.isSame(dayjs(), 'day')) {
    return parsed.format('HH:mm:ss');
  }

  return parsed.format('YYYY-MM-DD HH:mm:ss');
}

export function getHumanizedDateTime(date: string | Date | undefined | null): string {
  if (!date) {
    return '';
  }
  const parsed = dayjs(date);
  if (!parsed.isValid()) {
    return String(date);
  }
  return parsed.format('YYYY-MM-DD HH:mm:ss');
}

export function getHumanizedDuration(milliseconds: number | undefined | null): string {
  if (!milliseconds) {
    return '--';
  }

  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor((milliseconds / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((milliseconds / (1000 * 60)) % 60);
  const seconds = Math.floor((milliseconds / 1000) % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  if (seconds > 0) {
    return `${seconds}s`;
  }

  return `${milliseconds}ms`;
}

export function getProcessInstanceStateName(state: string): string {
  const labels: Record<string, string> = {
    running: 'Running',
    finished: 'Finished',
    fatal: 'Fatal',
    aborted: 'Aborted',
    compensated: 'Compensated',
    escalated: 'Escalated',
    error: 'Error',
  };

  return labels[state] ?? state;
}

export function getFlowNodeInstanceStateName(state: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    waiting: 'Waiting',
    finished: 'Finished',
    fatal: 'Fatal',
    aborted: 'Aborted',
    interrupted: 'Interrupted',
    error: 'Error',
  };

  return labels[state] ?? state;
}
