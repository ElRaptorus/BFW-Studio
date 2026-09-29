import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogContent } from '#bifrost/contracts/DialogTypes';
import { StandardDialogResponse } from '#bifrost/contracts/DialogTypes';
import type { EngineConnectionManager, RetryContext } from '#modules/engine-core';
import { ENGINE_COMMANDS, formatDeployErrorMessage } from '#modules/engine-core';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { BfwEngineClient } from '@elraptorus/bfw_engine_client';
import type { FlowNodeInstance, RetryRequest } from '@elraptorus/bfw_engine_sdk';
import { FlowNodeType } from '@elraptorus/bfw_engine_sdk';

import { ABORTABLE_STATES, RETRYABLE_STATES, TERMINAL_STATES } from '../constants/sharedResourceKeys';
import type { DashboardDocumentModel } from '../models/DashboardDocumentModel';
import type { DecisionCatalogDocumentModel } from '../models/DecisionCatalogDocumentModel';
import type { InstanceSearchDocumentModel } from '../models/InstanceSearchDocumentModel';
import type { ProcessExplorerDocumentModel } from '../models/ProcessExplorerDocumentModel';
import type { TaskInboxDocumentModel } from '../models/TaskInboxDocumentModel';
import type { TimerSchedulesDocumentModel } from '../models/TimerSchedulesDocumentModel';

function reportInstanceBulkOutcome(
  bifrost: Bifrost,
  pastParticiple: string,
  succeeded: number,
  failed: number,
  total: number,
): void {
  if (failed > 0) {
    bifrost.notifications.open({
      type: 'warning',
      content: `${succeeded} of ${total} instances ${pastParticiple}, ${failed} failed.`,
      source: 'Engine',
    });
    return;
  }
  bifrost.notifications.open({
    type: 'info',
    content: `${succeeded} instance${succeeded === 1 ? '' : 's'} ${pastParticiple}.`,
    source: 'Engine',
  });
}

function hasDeployBpmnCapability(connectionManager: EngineConnectionManager, engineId: string): boolean {
  const connection = connectionManager.getConnection(engineId);
  if (!connection) {
    return false;
  }
  return connectionManager.identity.hasCapability(connection.url, 'deploy_bpmn');
}

function hasDeployDmnCapability(connectionManager: EngineConnectionManager, engineId: string): boolean {
  const connection = connectionManager.getConnection(engineId);
  if (!connection) {
    return false;
  }
  return connectionManager.identity.hasCapability(connection.url, 'deploy_dmn');
}

async function deployFileFromPicker(
  bifrost: Bifrost,
  engineId: string,
  extension: 'bpmn' | 'dmn',
  message: string,
): Promise<void> {
  const picked = await bifrost.dialog.showOpenFile({
    properties: ['openFile'],
    message,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });

  if (!picked || (Array.isArray(picked) && picked.length === 0)) {
    return;
  }

  const filePath = Array.isArray(picked) ? picked[0] : picked;
  const content = await fs.readFile(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  await bifrost.commands.executeCommand(ENGINE_COMMANDS.deploy, [engineId, content, fileName]);

  bifrost.notifications.open({
    type: 'info',
    content: `Deployed "${fileName}" to engine.`,
    source: 'Engine',
  });
}

export default function initializeCommands(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  function requireClient(engineId: string): BfwEngineClient {
    const client = connectionManager.getClient(engineId);
    if (!client) {
      throw new Error('Not connected');
    }
    return client;
  }

  bifrost.commands.register(
    'engine.workspace.openDashboard',
    (engineId?: string) => {
      const resolvedId = engineId ?? connectionManager.getActiveEngineId();
      if (!resolvedId) {
        return;
      }
      connectionManager.setActiveEngine(resolvedId);
      bifrost.editors.focusOrOpenEditorDocument(`engine://dashboard/${resolvedId}`, 'Dashboard');
    },
    { visibleInSearch: true, description: ['Engine: Open Dashboard', 'Engine Dashboard'] },
  );

  bifrost.commands.register(
    'engine.workspace.openProcessExplorer',
    (engineId?: string) => {
      const resolvedId = engineId ?? connectionManager.getActiveEngineId();
      if (!resolvedId) {
        return;
      }
      connectionManager.setActiveEngine(resolvedId);
      bifrost.editors.focusOrOpenEditorDocument(`engine://processes/${resolvedId}`, 'Processes');
    },
    { visibleInSearch: true, description: ['Engine: Process Explorer', 'Engine Processes'] },
  );

  bifrost.commands.register(
    'engine.workspace.openInstanceSearch',
    async (engineId?: string, filter?: { processModelId?: string; version?: string; businessKey?: string }) => {
      const resolvedId = engineId ?? connectionManager.getActiveEngineId();
      if (!resolvedId) {
        return;
      }
      connectionManager.setActiveEngine(resolvedId);
      await openInstanceSearch(bifrost, resolvedId, filter);
    },
    { visibleInSearch: true, description: ['Engine: Instance Search', 'Engine Instances'] },
  );

  async function openInstanceSearch(
    studio: Bifrost,
    engineId: string,
    filter?: { processModelId?: string; version?: string; businessKey?: string },
  ): Promise<void> {
    const baseUri = `engine://instances/${engineId}`;

    let doc = studio.editors.getOpenEditorDocuments().find((existing) => existing.uri.startsWith(baseUri));

    if (!doc) {
      doc = studio.editors.focusOrOpenEditorDocument(baseUri, 'Instances');
    } else {
      studio.editors.focusOrOpenEditorDocument(doc.uri);
    }

    if (filter == null) {
      return;
    }

    const model = await studio.editors.getEditorDocumentModel<InstanceSearchDocumentModel>(doc);

    if (filter.processModelId) {
      model.setProcessModelIdFilter(filter.processModelId);
    }
    if (filter.version) {
      model.setVersionFilter(filter.version);
    }
    if (filter.businessKey) {
      model.setBusinessKeyFilter(filter.businessKey);
    }
  }

  bifrost.commands.register(
    'engine.workspace.openTaskInbox',
    (engineId?: string) => {
      const resolvedId = engineId ?? connectionManager.getActiveEngineId();
      if (!resolvedId) {
        return;
      }
      connectionManager.setActiveEngine(resolvedId);
      bifrost.editors.focusOrOpenEditorDocument(`engine-task-inbox://${resolvedId}`, 'Task Inbox');
    },
    { visibleInSearch: true, description: ['Engine: Task Inbox', 'Engine Tasks'] },
  );

  bifrost.commands.register(
    'engine.workspace.openDecisionCatalog',
    (engineId?: string) => {
      const resolvedId = engineId ?? connectionManager.getActiveEngineId();
      if (!resolvedId) {
        return;
      }
      connectionManager.setActiveEngine(resolvedId);
      bifrost.editors.focusOrOpenEditorDocument(`engine://decisions/${resolvedId}`, 'Decisions');
    },
    { visibleInSearch: true, description: ['Engine: Decision Catalog', 'Engine Decisions'] },
  );

  bifrost.commands.register(
    'engine.workspace.openTimerSchedules',
    (engineId?: string) => {
      const resolvedId = engineId ?? connectionManager.getActiveEngineId();
      if (!resolvedId) {
        return;
      }
      connectionManager.setActiveEngine(resolvedId);
      bifrost.editors.focusOrOpenEditorDocument(`engine://timers/${resolvedId}`, 'Timers');
    },
    { visibleInSearch: true, description: ['Engine: Timer Schedules', 'Engine Timers'] },
  );

  bifrost.commands.register(
    'engine.workspace.openModelViewer',
    (engineId: string, processModelId: string) => {
      connectionManager.setActiveEngine(engineId);
      bifrost.editors.focusOrOpenEditorDocument(`engine-model://${engineId}/${processModelId}`, processModelId);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.workspace.openDecisionViewer',
    (engineId: string, decisionModelId: string) => {
      connectionManager.setActiveEngine(engineId);
      bifrost.editors.focusOrOpenEditorDocument(`engine-decision://${engineId}/${decisionModelId}`, decisionModelId);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.workspace.toggleProcessEnabled',
    async (engineId: string, processModelId: string, enabled: boolean) => {
      const client = requireClient(engineId);
      if (enabled) {
        await client.processes.enable(processModelId);
      } else {
        await client.processes.disable(processModelId);
      }
      bifrost.notifications.open({
        type: 'info',
        content: `Process "${processModelId}" ${enabled ? 'enabled' : 'disabled'}.`,
        source: 'Engine',
      });
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.workspace.removeProcessFromEngine',
    async (engineId: string, processModelId: string) => {
      const client = requireClient(engineId);
      await client.processes.undeploy(processModelId);
      bifrost.notifications.open({
        type: 'info',
        content: `Process "${processModelId}" removed from engine.`,
        source: 'Engine',
      });
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.workspace.completeTask',
    async (engineId: string, task: Pick<FlowNodeInstance, 'id' | 'flowNodeType'>) => {
      const client = requireClient(engineId);
      await completeInboxTask(client, task);
      bifrost.notifications.open({ type: 'info', content: 'Task completed.', source: 'Engine' });
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.workspace.startProcessFromModelViewer',
    async (engineId: string, processModelId: string) => {
      const result = await bifrost.commands.executeCommand(ENGINE_COMMANDS.startProcess, [engineId, processModelId]);
      if (result?.processInstanceId) {
        await bifrost.commands.executeCommand('engine.debugger.focusOrOpen', [engineId, result.processInstanceId]);
      }
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.workspace.toggleDecisionEnabled',
    async (engineId: string, decisionModelId: string, enabled: boolean) => {
      const client = requireClient(engineId);
      if (enabled) {
        await client.decisions.enable(decisionModelId);
      } else {
        await client.decisions.disable(decisionModelId);
      }
      bifrost.notifications.open({
        type: 'info',
        content: `Decision "${decisionModelId}" ${enabled ? 'enabled' : 'disabled'}.`,
        source: 'Engine',
      });
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.workspace.removeDecisionFromEngine',
    async (engineId: string, decisionModelId: string) => {
      const client = requireClient(engineId);
      await client.decisions.undeploy(decisionModelId);
      bifrost.notifications.open({
        type: 'info',
        content: `Decision "${decisionModelId}" removed from engine.`,
        source: 'Engine',
      });
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.workspace.deployProcessFile',
    async (engineId: string) => {
      try {
        await deployFileFromPicker(bifrost, engineId, 'bpmn', 'Select BPMN process to deploy');
      } catch (error: any) {
        bifrost.notifications.open({
          type: 'error',
          content: formatDeployErrorMessage(error),
          source: 'Engine',
        });
      }
    },
    {
      enabledWhen: (engineId: string) =>
        connectionManager.isConnected(engineId) && hasDeployBpmnCapability(connectionManager, engineId),
    },
  );

  bifrost.commands.register(
    'engine.workspace.deployDecisionFile',
    async (engineId: string) => {
      try {
        await deployFileFromPicker(bifrost, engineId, 'dmn', 'Select DMN decision to deploy');
      } catch (error: any) {
        bifrost.notifications.open({
          type: 'error',
          content: formatDeployErrorMessage(error),
          source: 'Engine',
        });
      }
    },
    {
      enabledWhen: (engineId: string) =>
        connectionManager.isConnected(engineId) && hasDeployDmnCapability(connectionManager, engineId),
    },
  );

  bifrost.commands.register(
    'engine.workspace.processExplorer.enableSelected',
    async (model: ProcessExplorerDocumentModel) => {
      const client = requireClient(model.getEngineId());
      for (const processModel of model.getSelectedModels()) {
        await client.processes.enable(processModel.processModelId ?? processModel.id);
      }
      await model.refresh();
    },
    { enabledWhen: (model: ProcessExplorerDocumentModel) => model?.getSelectedModelIds()?.length > 0 },
  );

  bifrost.commands.register(
    'engine.workspace.processExplorer.disableSelected',
    async (model: ProcessExplorerDocumentModel) => {
      const client = requireClient(model.getEngineId());
      for (const processModel of model.getSelectedModels()) {
        await client.processes.disable(processModel.processModelId ?? processModel.id);
      }
      await model.refresh();
    },
    { enabledWhen: (model: ProcessExplorerDocumentModel) => model?.getSelectedModelIds()?.length > 0 },
  );

  bifrost.commands.register(
    'engine.workspace.processExplorer.removeSelected',
    async (model: ProcessExplorerDocumentModel) => {
      const client = requireClient(model.getEngineId());
      for (const processModel of model.getSelectedModels()) {
        await client.processes.undeploy(processModel.processModelId ?? processModel.id);
      }
      model.clearBulkSelection();
      await model.refresh();
    },
    { enabledWhen: (model: ProcessExplorerDocumentModel) => model?.getSelectedModelIds()?.length > 0 },
  );

  bifrost.commands.register('engine.workspace.processExplorer.refresh', async (model: ProcessExplorerDocumentModel) =>
    model.refresh(),
  );

  bifrost.commands.register(
    'engine.workspace.decisionCatalog.enableSelected',
    async (model: DecisionCatalogDocumentModel) => {
      const client = requireClient(model.getEngineId());
      for (const decision of model.getSelectedDecisions()) {
        await client.decisions.enable(decision.decisionDefinitionId ?? decision.id);
      }
      await model.refresh();
    },
    { enabledWhen: (model: DecisionCatalogDocumentModel) => model?.getSelectedDecisionIds()?.length > 0 },
  );

  bifrost.commands.register(
    'engine.workspace.decisionCatalog.disableSelected',
    async (model: DecisionCatalogDocumentModel) => {
      const client = requireClient(model.getEngineId());
      for (const decision of model.getSelectedDecisions()) {
        await client.decisions.disable(decision.decisionDefinitionId ?? decision.id);
      }
      await model.refresh();
    },
    { enabledWhen: (model: DecisionCatalogDocumentModel) => model?.getSelectedDecisionIds()?.length > 0 },
  );

  bifrost.commands.register(
    'engine.workspace.decisionCatalog.removeSelected',
    async (model: DecisionCatalogDocumentModel) => {
      const client = requireClient(model.getEngineId());
      for (const decision of model.getSelectedDecisions()) {
        const decisionModelId = decision.decisionDefinitionId ?? decision.id;
        await client.decisions.disable(decisionModelId);
        await client.decisions.undeploy(decisionModelId);
      }
      model.clearBulkSelection();
      await model.refresh();
    },
    { enabledWhen: (model: DecisionCatalogDocumentModel) => model?.getSelectedDecisionIds()?.length > 0 },
  );

  bifrost.commands.register('engine.workspace.decisionCatalog.refresh', async (model: DecisionCatalogDocumentModel) =>
    model.refresh(),
  );

  bifrost.commands.register('engine.workspace.dashboard.refresh', async (model: DashboardDocumentModel) =>
    model.refresh(),
  );

  bifrost.commands.register(
    'engine.workspace.instanceSearch.abortSelected',
    async (model: InstanceSearchDocumentModel) => {
      const selected = model.getSelectedInstances();
      const abortable = selected.filter((inst) => ABORTABLE_STATES.has(inst.state));

      if (abortable.length === 0) {
        return;
      }

      const confirmed = await showBulkAbortDialog(bifrost, abortable.length, selected.length);
      if (!confirmed) {
        return;
      }

      let succeeded = 0;
      let failed = 0;
      for (const instance of abortable) {
        try {
          await bifrost.commands.executeCommand(ENGINE_COMMANDS.abortProcessInstance, [
            model.getEngineId(),
            instance.id,
          ]);
          succeeded++;
        } catch {
          failed++;
        }
      }
      reportInstanceBulkOutcome(bifrost, 'aborted', succeeded, failed, abortable.length);
      model.setSelectedInstanceIds([]);
      await model.refresh();
    },
    {
      enabledWhen: (model: InstanceSearchDocumentModel) =>
        model?.getSelectedInstances().some((inst) => ABORTABLE_STATES.has(inst.state)) ?? false,
    },
  );

  bifrost.commands.register(
    'engine.workspace.instanceSearch.deleteSelected',
    async (model: InstanceSearchDocumentModel) => {
      const selected = model.getSelectedInstances();
      const deletable = selected.filter((inst) => TERMINAL_STATES.has(inst.state));

      if (deletable.length === 0) {
        return;
      }

      const confirmed = await showBulkDeleteDialog(bifrost, deletable.length, selected.length);
      if (!confirmed) {
        return;
      }

      let succeeded = 0;
      let failed = 0;
      for (const instance of deletable) {
        try {
          await bifrost.commands.executeCommand(ENGINE_COMMANDS.deleteProcessInstance, [
            model.getEngineId(),
            instance.id,
          ]);
          succeeded++;
        } catch {
          failed++;
        }
      }
      reportInstanceBulkOutcome(bifrost, 'deleted', succeeded, failed, deletable.length);
      model.setSelectedInstanceIds([]);
      await model.refresh();
    },
    {
      enabledWhen: (model: InstanceSearchDocumentModel) =>
        model?.getSelectedInstances().some((inst) => TERMINAL_STATES.has(inst.state)) ?? false,
    },
  );

  bifrost.commands.register(
    'engine.workspace.instanceSearch.retrySelected',
    async (model: InstanceSearchDocumentModel) => {
      const selected = model.getSelectedInstances();
      const retryable = selected.filter((inst) => RETRYABLE_STATES.has(inst.state));

      if (retryable.length === 0) {
        return;
      }

      const dialogResult = await showBulkRetryDialog(bifrost, retryable.length, selected.length);
      if (!dialogResult) {
        return;
      }

      let succeeded = 0;
      let failed = 0;
      for (const instance of retryable) {
        try {
          await bifrost.commands.executeCommand(ENGINE_COMMANDS.retryProcessInstance, [
            model.getEngineId(),
            instance.id,
            dialogResult,
          ]);
          succeeded++;
        } catch {
          failed++;
        }
      }
      reportInstanceBulkOutcome(bifrost, 'retried', succeeded, failed, retryable.length);
      model.setSelectedInstanceIds([]);
      await model.refresh();
    },
    {
      enabledWhen: (model: InstanceSearchDocumentModel) =>
        model?.getSelectedInstances().some((inst) => RETRYABLE_STATES.has(inst.state)) ?? false,
    },
  );

  bifrost.commands.register('engine.workspace.instanceSearch.refresh', async (model: InstanceSearchDocumentModel) =>
    model.refresh(),
  );

  bifrost.commands.register(
    'engine.workspace.instanceSearch.loadMore',
    async (model: InstanceSearchDocumentModel) => model.goToNextPage(),
    { enabledWhen: (model: InstanceSearchDocumentModel) => model != null },
  );

  bifrost.commands.register(
    'engine.workspace.taskInbox.completeSelected',
    async (model: TaskInboxDocumentModel) => {
      const client = connectionManager.getClient(model.getEngineId());
      const selected = model.getSelectedTasks();
      if (!client || selected.length === 0) {
        return;
      }
      for (const task of selected) {
        await completeInboxTask(client, task);
      }
      model.setSelectedTaskIds([]);
      await model.refresh();
    },
    { enabledWhen: (model: TaskInboxDocumentModel) => model?.getSelectedTaskIds()?.length > 0 },
  );

  bifrost.commands.register('engine.workspace.taskInbox.refresh', async (model: TaskInboxDocumentModel) =>
    model.refresh(),
  );

  bifrost.commands.register(
    'engine.workspace.timerSchedules.enableSelected',
    async (model: TimerSchedulesDocumentModel) => {
      const engineId = model.getEngineId();
      for (const schedule of model.getSelectedSchedules()) {
        await enableTimerSchedule(connectionManager, engineId, schedule.id);
      }
      await model.refresh();
    },
    { enabledWhen: (model: TimerSchedulesDocumentModel) => model?.getSelectedScheduleIds()?.length > 0 },
  );

  bifrost.commands.register(
    'engine.workspace.timerSchedules.disableSelected',
    async (model: TimerSchedulesDocumentModel) => {
      const engineId = model.getEngineId();
      for (const schedule of model.getSelectedSchedules()) {
        await disableTimerSchedule(connectionManager, engineId, schedule.id);
      }
      await model.refresh();
    },
    { enabledWhen: (model: TimerSchedulesDocumentModel) => model?.getSelectedScheduleIds()?.length > 0 },
  );

  bifrost.commands.register('engine.workspace.timerSchedules.refresh', async (model: TimerSchedulesDocumentModel) =>
    model.refresh(),
  );

  bifrost.commands.register('engine.workspace.instanceSearch.applyColumnFilter', (columnId: string, value: string) => {
    const instanceSearchDoc = bifrost.editors
      .getOpenEditorDocuments()
      .find((document) => document.uri.startsWith('engine://instances/'));
    if (!instanceSearchDoc) {
      return;
    }
    const model = bifrost.editors.getEditorDocumentModelIfPresent<InstanceSearchDocumentModel>(instanceSearchDoc);
    model?.applyColumnFilter(columnId, value);
  });

  bifrost.commands.register('engine.workspace.processExplorer.applyColumnFilter', (columnId: string, value: string) => {
    const doc = bifrost.editors
      .getOpenEditorDocuments()
      .find((document) => document.uri.startsWith('engine://processes/'));
    if (!doc) {
      return;
    }
    const model = bifrost.editors.getEditorDocumentModelIfPresent<ProcessExplorerDocumentModel>(doc);
    model?.applyColumnFilter(columnId, value);
  });

  bifrost.commands.register('engine.workspace.decisionCatalog.applyColumnFilter', (columnId: string, value: string) => {
    const doc = bifrost.editors
      .getOpenEditorDocuments()
      .find((document) => document.uri.startsWith('engine://decisions/'));
    if (!doc) {
      return;
    }
    const model = bifrost.editors.getEditorDocumentModelIfPresent<DecisionCatalogDocumentModel>(doc);
    model?.applyColumnFilter(columnId, value);
  });

  bifrost.commands.register('engine.workspace.taskInbox.applyColumnFilter', (columnId: string, value: string) => {
    const doc = bifrost.editors
      .getOpenEditorDocuments()
      .find((document) => document.uri.startsWith('engine-task-inbox://'));
    if (!doc) {
      return;
    }
    const model = bifrost.editors.getEditorDocumentModelIfPresent<TaskInboxDocumentModel>(doc);
    model?.applyColumnFilter(columnId, value);
  });

  bifrost.commands.register('engine.workspace.timerSchedules.applyColumnFilter', (columnId: string, value: string) => {
    const doc = bifrost.editors
      .getOpenEditorDocuments()
      .find((document) => document.uri.startsWith('engine://timers/'));
    if (!doc) {
      return;
    }
    const model = bifrost.editors.getEditorDocumentModelIfPresent<TimerSchedulesDocumentModel>(doc);
    model?.applyColumnFilter(columnId, value);
  });

  bifrost.commands.register(
    'engine.workspace.instanceSearch.abortSingle',
    async (engineId: string, instanceId: string) => {
      await bifrost.commands.executeCommand(ENGINE_COMMANDS.configuredAbortProcessInstance, [engineId, instanceId]);
    },
  );

  bifrost.commands.register(
    'engine.workspace.instanceSearch.deleteSingle',
    async (engineId: string, instanceId: string) => {
      await bifrost.commands.executeCommand(ENGINE_COMMANDS.configuredDeleteProcessInstance, [engineId, instanceId]);
    },
  );

  bifrost.commands.register(
    'engine.workspace.instanceSearch.retrySingle',
    async (engineId: string, instanceId: string, context?: RetryContext) => {
      await bifrost.commands.executeCommand(ENGINE_COMMANDS.configuredRetryProcessInstance, [
        engineId,
        instanceId,
        context,
      ]);
    },
  );

  bifrost.commands.register('engine.workspace.timerSchedules.fetch', async (engineId: string) =>
    fetchTimerSchedules(connectionManager, engineId),
  );

  bifrost.commands.register(
    'engine.workspace.timerSchedules.toggleSingle',
    async (engineId: string, scheduleId: string, enabled: boolean) => {
      if (enabled) {
        await enableTimerSchedule(connectionManager, engineId, scheduleId);
      } else {
        await disableTimerSchedule(connectionManager, engineId, scheduleId);
      }
    },
  );

  interface TimerSchedule {
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

  async function fetchTimerSchedules(
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

  async function enableTimerSchedule(
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

  async function disableTimerSchedule(
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

  bifrost.commands.register(
    'engine.workspace.taskInbox.completeSingle',
    async (engineId: string, task: Pick<FlowNodeInstance, 'id' | 'flowNodeType'>) => {
      const client = connectionManager.getClient(engineId);
      if (!client) {
        return;
      }
      await completeInboxTask(client, task);
    },
  );
}

export async function completeInboxTask(
  client: Pick<BfwEngineClient, 'userTasks' | 'manualTasks'>,
  task: Pick<FlowNodeInstance, 'id' | 'flowNodeType'>,
): Promise<void> {
  switch (task.flowNodeType) {
    case FlowNodeType.ManualTask:
      await client.manualTasks.confirm(task.id);
      return;
    case FlowNodeType.UserTask:
      await client.userTasks.finish(task.id);
      return;
    default:
      throw new Error(`Task ${task.id} of type ${task.flowNodeType} cannot be completed from the inbox.`);
  }
}

async function showBulkRetryDialog(
  bifrost: Bifrost,
  retryableCount: number,
  totalSelectedCount: number,
): Promise<RetryRequest | null> {
  const summary =
    retryableCount === totalSelectedCount
      ? `This will retry **${retryableCount}** process instance${retryableCount === 1 ? '' : 's'}.`
      : `This will retry **${retryableCount}** of **${totalSelectedCount}** selected process instances (only instances in error, fatal, or aborted state).`;

  const content: DialogContent = [
    { type: 'markdown', text: `${summary} This action cannot be undone.` },
    { type: 'divider' },
    {
      type: 'select',
      id: 'targetVersion',
      label: 'Target Version',
      value: '',
      entries: [
        { label: 'Same version per instance', value: '' },
        { label: 'Latest enabled version', value: 'latest' },
      ],
    },
  ];

  const dialogResult = await bifrost.dialog.open({
    title: `Retry ${retryableCount} Process Instance${retryableCount === 1 ? '' : 's'}`,
    content,
    actions: [
      { label: 'Cancel', response: StandardDialogResponse.Cancel, cancel: true },
      { label: 'Retry All', response: 'retry', dangerous: true, default: true },
    ],
  });

  if (dialogResult.wasCancelled || dialogResult.response === 'cancel') {
    return null;
  }

  const selectedVersion = dialogResult.formData?.targetVersion as string | undefined;
  const retryRequest: RetryRequest = {};
  if (selectedVersion && selectedVersion.length > 0) {
    retryRequest.version = selectedVersion;
  }
  return retryRequest;
}

async function showBulkAbortDialog(
  bifrost: Bifrost,
  abortableCount: number,
  totalSelectedCount: number,
): Promise<boolean> {
  const summary =
    abortableCount === totalSelectedCount
      ? `This will abort **${abortableCount}** process instance${abortableCount === 1 ? '' : 's'}.`
      : `This will abort **${abortableCount}** of **${totalSelectedCount}** selected process instances (only running instances).`;

  const dialogResult = await bifrost.dialog.open({
    title: `Abort ${abortableCount} Process Instance${abortableCount === 1 ? '' : 's'}`,
    content: [{ type: 'markdown', text: `${summary} This action cannot be undone.` }],
    actions: [
      { label: 'Cancel', response: StandardDialogResponse.Cancel, cancel: true },
      { label: 'Abort All', response: 'abort', dangerous: true, default: true },
    ],
  });

  return !dialogResult.wasCancelled && dialogResult.response === 'abort';
}

async function showBulkDeleteDialog(
  bifrost: Bifrost,
  deletableCount: number,
  totalSelectedCount: number,
): Promise<boolean> {
  const summary =
    deletableCount === totalSelectedCount
      ? `This will permanently delete **${deletableCount}** process instance${deletableCount === 1 ? '' : 's'} and all associated data.`
      : `This will permanently delete **${deletableCount}** of **${totalSelectedCount}** selected process instances (only terminal instances).`;

  const dialogResult = await bifrost.dialog.open({
    title: `Delete ${deletableCount} Process Instance${deletableCount === 1 ? '' : 's'}`,
    content: [{ type: 'markdown', text: `${summary} This action cannot be undone.` }],
    actions: [
      { label: 'Cancel', response: StandardDialogResponse.Cancel, cancel: true },
      { label: 'Delete All', response: 'delete', dangerous: true, default: true },
    ],
  });

  return !dialogResult.wasCancelled && dialogResult.response === 'delete';
}
