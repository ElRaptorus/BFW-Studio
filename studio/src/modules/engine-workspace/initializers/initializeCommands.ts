import type { Bifrost } from '#bifrost/Bifrost';
import type { EngineConnectionManager, RetryContext } from '#modules/engine-core';
import { ENGINE_COMMANDS, formatDeployErrorMessage } from '#modules/engine-core';
import type { RetryRequest } from '@elraptorus/daemonengine_sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { DialogContent, Menu, Studio } from '@evil/bifrost_fw_sdk';
import { StandardDialogResponse } from '@evil/bifrost_fw_sdk';

import {
  openDecisionViewer,
  openInstanceSearch,
  openModelViewer,
  removeProcessFromEngine,
  toggleProcessEnabled,
} from '../helpers/workspaceNavigation';
import type { DashboardDocumentModel } from '../models/DashboardDocumentModel';
import type { DecisionCatalogDocumentModel } from '../models/DecisionCatalogDocumentModel';
import type { InstanceSearchDocumentModel } from '../models/InstanceSearchDocumentModel';
import type { ProcessExplorerDocumentModel } from '../models/ProcessExplorerDocumentModel';
import type { TaskInboxDocumentModel } from '../models/TaskInboxDocumentModel';
import type { TimerSchedulesDocumentModel } from '../models/TimerSchedulesDocumentModel';
import type { DecisionCatalogContextMetadata } from '../types/DecisionCatalogContext';
import type { InstanceSearchContextMetadata } from '../types/InstanceSearchContext';
import type { ProcessExplorerContextMetadata } from '../types/ProcessExplorerContext';
import type { TaskInboxContextMetadata } from '../types/TaskInboxContext';
import type { TimerSchedulesContextMetadata } from '../types/TimerSchedulesContext';

const RETRYABLE_STATES = new Set(['fatal', 'aborted', 'error']);

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
      openModelViewer(bifrost, engineId, processModelId);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.workspace.openDecisionViewer',
    (engineId: string, decisionModelId: string) => {
      connectionManager.setActiveEngine(engineId);
      openDecisionViewer(bifrost, engineId, decisionModelId);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.workspace.toggleProcessEnabled',
    async (engineId: string, processModelId: string, enabled: boolean) => {
      await toggleProcessEnabled(connectionManager, engineId, processModelId, enabled);
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
      await removeProcessFromEngine(connectionManager, engineId, processModelId);
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
    async (engineId: string, flowNodeInstanceId: string, result?: Record<string, unknown>) => {
      const client = connectionManager.getClient(engineId);
      if (!client) {
        throw new Error('Not connected');
      }
      await client.userTasks.finish(flowNodeInstanceId, { result });
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
      const client = connectionManager.getClient(engineId);
      if (!client) {
        throw new Error('Not connected');
      }
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
      const client = connectionManager.getClient(engineId);
      if (!client) {
        throw new Error('Not connected');
      }
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
    async (model: ProcessExplorerDocumentModel) => model.bulkToggleSelected(true),
    { enabledWhen: (model: ProcessExplorerDocumentModel) => model?.getSelectedModelIds()?.length > 0 },
  );

  bifrost.commands.register(
    'engine.workspace.processExplorer.disableSelected',
    async (model: ProcessExplorerDocumentModel) => model.bulkToggleSelected(false),
    { enabledWhen: (model: ProcessExplorerDocumentModel) => model?.getSelectedModelIds()?.length > 0 },
  );

  bifrost.commands.register(
    'engine.workspace.processExplorer.removeSelected',
    async (model: ProcessExplorerDocumentModel) => model.bulkRemoveSelected(),
    { enabledWhen: (model: ProcessExplorerDocumentModel) => model?.getSelectedModelIds()?.length > 0 },
  );

  bifrost.commands.register('engine.workspace.processExplorer.refresh', async (model: ProcessExplorerDocumentModel) =>
    model.refresh(),
  );

  bifrost.commands.register(
    'engine.workspace.decisionCatalog.enableSelected',
    async (model: DecisionCatalogDocumentModel) => model.bulkToggleSelected(true),
    { enabledWhen: (model: DecisionCatalogDocumentModel) => model?.getSelectedDecisionIds()?.length > 0 },
  );

  bifrost.commands.register(
    'engine.workspace.decisionCatalog.disableSelected',
    async (model: DecisionCatalogDocumentModel) => model.bulkToggleSelected(false),
    { enabledWhen: (model: DecisionCatalogDocumentModel) => model?.getSelectedDecisionIds()?.length > 0 },
  );

  bifrost.commands.register(
    'engine.workspace.decisionCatalog.removeSelected',
    async (model: DecisionCatalogDocumentModel) => model.bulkRemoveSelected(),
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
    async (model: InstanceSearchDocumentModel) => model.bulkAbortSelected(),
    { enabledWhen: (model: InstanceSearchDocumentModel) => model?.getSelectedInstanceIds()?.length > 0 },
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

      await model.bulkRetrySelected(retryable, dialogResult);
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
    async (model: TaskInboxDocumentModel) => model.bulkCompleteSelected(),
    { enabledWhen: (model: TaskInboxDocumentModel) => model?.getSelectedTaskIds()?.length > 0 },
  );

  bifrost.commands.register('engine.workspace.taskInbox.refresh', async (model: TaskInboxDocumentModel) =>
    model.refresh(),
  );

  bifrost.commands.register(
    'engine.workspace.timerSchedules.enableSelected',
    async (model: TimerSchedulesDocumentModel) => model.bulkToggleSelected(true),
    { enabledWhen: (model: TimerSchedulesDocumentModel) => model?.getSelectedScheduleIds()?.length > 0 },
  );

  bifrost.commands.register(
    'engine.workspace.timerSchedules.disableSelected',
    async (model: TimerSchedulesDocumentModel) => model.bulkToggleSelected(false),
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
      await bifrost.commands.executeCommand(ENGINE_COMMANDS.abortProcessInstance, [engineId, instanceId]);
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

  bifrost.commands.register(
    'engine.workspace.timerSchedules.toggleSingle',
    async (engineId: string, scheduleId: string, enabled: boolean) => {
      if (enabled) {
        const { enableTimerSchedule } = await import('../helpers/engineApi');
        await enableTimerSchedule(connectionManager, engineId, scheduleId);
      } else {
        const { disableTimerSchedule } = await import('../helpers/engineApi');
        await disableTimerSchedule(connectionManager, engineId, scheduleId);
      }
    },
  );

  bifrost.commands.register('engine.workspace.taskInbox.completeSingle', async (engineId: string, taskId: string) => {
    const client = connectionManager.getClient(engineId);
    if (!client) {
      return;
    }
    await client.userTasks.finish(taskId, {});
  });
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

function truncateForMenu(value: string, maxLength = 24): string {
  return value.length > maxLength ? value.slice(0, maxLength) + '...' : value;
}

const PROCESS_EXPLORER_FILTERABLE_COLUMNS: Record<string, string> = {
  name: 'Name',
  processModelId: 'Process ID',
  version: 'Version',
};

const DECISION_CATALOG_FILTERABLE_COLUMNS: Record<string, string> = {
  name: 'Name',
  decisionDefinitionId: 'Model ID',
  version: 'Version',
};

const TASK_INBOX_FILTERABLE_COLUMNS: Record<string, string> = {
  flowNodeId: 'Task',
  processInstanceId: 'Process Instance',
  laneName: 'Lane',
};

const TIMER_SCHEDULES_FILTERABLE_COLUMNS: Record<string, string> = {
  processModelId: 'Process',
  flowNodeId: 'Start Event',
  kind: 'Kind',
};

export function buildProcessExplorerContextMenu(_studio: Studio, metadata: ProcessExplorerContextMetadata): Menu {
  const { engineId, processModel, columnId, cellValue } = metadata;
  const enabled = processModel.enabled ?? true;
  const bpmnId = processModel.processModelId ?? processModel.id;

  const filterEntry: Menu =
    columnId && cellValue && PROCESS_EXPLORER_FILTERABLE_COLUMNS[columnId]
      ? [
          {
            type: 'command' as const,
            id: `engine-workspace/process-explorer/use-as-filter-${columnId}`,
            label: `Use "${truncateForMenu(cellValue)}" as ${PROCESS_EXPLORER_FILTERABLE_COLUMNS[columnId]} Filter`,
            icon: 'ph ph-funnel',
            command: 'engine.workspace.processExplorer.applyColumnFilter',
            commandArgs: [columnId, cellValue],
          },
          { type: 'divider' as const },
        ]
      : [];

  return [
    ...filterEntry,
    {
      type: 'command',
      id: 'engine-workspace/process-explorer/open-model',
      label: 'Open in Model Viewer',
      icon: 'ph ph-folder-open',
      command: 'engine.workspace.openModelViewer',
      commandArgs: [engineId, bpmnId],
    },
    {
      type: 'command',
      id: 'engine-workspace/process-explorer/start-process',
      label: 'Start in Debugger',
      icon: 'ph ph-play',
      command: ENGINE_COMMANDS.startProcessAndOpenDebugger,
      commandArgs: [engineId, bpmnId],
    },
    {
      type: 'command',
      id: 'engine-workspace/process-explorer/configured-start-process',
      label: 'Configured Start in Debugger...',
      icon: 'ph ph-sliders-horizontal',
      command: ENGINE_COMMANDS.configuredStartProcessAndOpenDebugger,
      commandArgs: [engineId, bpmnId],
    },
    { type: 'divider' },
    {
      type: 'command',
      id: 'engine-workspace/process-explorer/show-instances',
      label: 'Show Process Instances',
      command: 'engine.workspace.openInstanceSearch',
      commandArgs: [engineId, { processModelId: bpmnId }],
    },
    { type: 'divider' },
    {
      type: 'command',
      id: 'engine-workspace/process-explorer/toggle-enabled',
      label: enabled ? 'Disable' : 'Enable',
      icon: enabled ? 'ph ph-prohibit' : 'ph ph-check-circle',
      command: 'engine.workspace.toggleProcessEnabled',
      commandArgs: [engineId, bpmnId, !enabled],
    },
    {
      type: 'command',
      id: 'engine-workspace/process-explorer/remove',
      label: 'Remove from Engine',
      icon: 'ph ph-trash',
      command: 'engine.workspace.removeProcessFromEngine',
      commandArgs: [engineId, bpmnId],
    },
  ];
}

export function buildDecisionCatalogContextMenu(_studio: Studio, metadata: DecisionCatalogContextMetadata): Menu {
  const { engineId, decision, columnId, cellValue } = metadata;
  const enabled = decision.enabled ?? true;
  const dmnId = decision.decisionDefinitionId ?? decision.id;

  const filterEntry: Menu =
    columnId && cellValue && DECISION_CATALOG_FILTERABLE_COLUMNS[columnId]
      ? [
          {
            type: 'command' as const,
            id: `engine-workspace/decision-catalog/use-as-filter-${columnId}`,
            label: `Use "${truncateForMenu(cellValue)}" as ${DECISION_CATALOG_FILTERABLE_COLUMNS[columnId]} Filter`,
            icon: 'ph ph-funnel',
            command: 'engine.workspace.decisionCatalog.applyColumnFilter',
            commandArgs: [columnId, cellValue],
          },
          { type: 'divider' as const },
        ]
      : [];

  return [
    ...filterEntry,
    {
      type: 'command',
      id: 'engine-workspace/decision-catalog/open-viewer',
      label: 'Open in Decision Viewer',
      icon: 'ph ph-folder-open',
      command: 'engine.workspace.openDecisionViewer',
      commandArgs: [engineId, dmnId],
    },
    { type: 'divider' },
    {
      type: 'command',
      id: 'engine-workspace/decision-catalog/toggle-enabled',
      label: enabled ? 'Disable' : 'Enable',
      icon: enabled ? 'ph ph-prohibit' : 'ph ph-check-circle',
      command: 'engine.workspace.toggleDecisionEnabled',
      commandArgs: [engineId, dmnId, !enabled],
    },
    {
      type: 'command',
      id: 'engine-workspace/decision-catalog/remove',
      label: 'Remove from Engine',
      icon: 'ph ph-trash',
      command: 'engine.workspace.removeDecisionFromEngine',
      commandArgs: [engineId, dmnId],
    },
  ];
}

const FILTERABLE_COLUMN_LABELS: Record<string, string> = {
  id: 'Instance ID',
  processModelId: 'Process',
  version: 'Version',
  businessKey: 'Business Key',
};

export function buildInstanceSearchContextMenu(_studio: Studio, metadata: InstanceSearchContextMetadata): Menu {
  const { engineId, instance, columnId, cellValue } = metadata;
  const isRetryable = RETRYABLE_STATES.has(instance.state);
  const isRunning = instance.state === 'running';

  const filterEntry: Menu =
    columnId && cellValue && FILTERABLE_COLUMN_LABELS[columnId]
      ? [
          {
            type: 'command' as const,
            id: `engine-workspace/instance-search/use-as-filter-${columnId}`,
            label: `Use "${truncateForMenu(cellValue)}" as ${FILTERABLE_COLUMN_LABELS[columnId]} Filter`,
            icon: 'ph ph-funnel',
            command: 'engine.workspace.instanceSearch.applyColumnFilter',
            commandArgs: [columnId, cellValue],
          },
          { type: 'divider' as const },
        ]
      : [];

  return [
    ...filterEntry,
    {
      type: 'command',
      id: 'engine-workspace/instance-search/open-debugger',
      label: 'Open in Debugger',
      icon: 'ph ph-bug',
      command: 'engine.debugger.focusOrOpen',
      commandArgs: [engineId, instance.id],
    },
    ...(instance.processModelId
      ? [
          {
            type: 'command' as const,
            id: 'engine-workspace/instance-search/open-model',
            label: 'Open Process in Model Viewer',
            icon: 'ph ph-flow-arrow',
            command: 'engine.workspace.openModelViewer',
            commandArgs: [engineId, instance.processModelId],
          },
        ]
      : []),
    { type: 'divider' },
    ...(isRunning
      ? [
          {
            type: 'command' as const,
            id: 'engine-workspace/instance-search/abort',
            label: 'Abort Instance',
            icon: 'ph ph-stop',
            command: 'engine.workspace.instanceSearch.abortSingle',
            commandArgs: [engineId, instance.id],
          },
        ]
      : []),
    ...(isRetryable
      ? [
          {
            type: 'command' as const,
            id: 'engine-workspace/instance-search/retry',
            label: 'Retry Instance',
            icon: 'ph ph-arrow-counter-clockwise',
            command: 'engine.workspace.instanceSearch.retrySingle',
            commandArgs: [
              engineId,
              instance.id,
              {
                processModelId: (instance as any).processModelId,
                currentVersion: (instance as any).version,
              } satisfies RetryContext,
            ],
          },
        ]
      : []),
  ];
}

export function buildTimerSchedulesContextMenu(_studio: Studio, metadata: TimerSchedulesContextMetadata): Menu {
  const { engineId, schedule, columnId, cellValue } = metadata;
  const enabled = schedule.enabled ?? true;

  const filterEntry: Menu =
    columnId && cellValue && TIMER_SCHEDULES_FILTERABLE_COLUMNS[columnId]
      ? [
          {
            type: 'command' as const,
            id: `engine-workspace/timer-schedules/use-as-filter-${columnId}`,
            label: `Use "${truncateForMenu(cellValue)}" as ${TIMER_SCHEDULES_FILTERABLE_COLUMNS[columnId]} Filter`,
            icon: 'ph ph-funnel',
            command: 'engine.workspace.timerSchedules.applyColumnFilter',
            commandArgs: [columnId, cellValue],
          },
          { type: 'divider' as const },
        ]
      : [];

  return [
    ...filterEntry,
    {
      type: 'command',
      id: 'engine-workspace/timer-schedules/open-model',
      label: 'Open Process in Model Viewer',
      icon: 'ph ph-flow-arrow',
      command: 'engine.workspace.openModelViewer',
      commandArgs: [engineId, schedule.processModelId],
    },
    { type: 'divider' },
    {
      type: 'command',
      id: 'engine-workspace/timer-schedules/toggle-enabled',
      label: enabled ? 'Disable Schedule' : 'Enable Schedule',
      icon: enabled ? 'ph ph-prohibit' : 'ph ph-check-circle',
      command: 'engine.workspace.timerSchedules.toggleSingle',
      commandArgs: [engineId, schedule.id, !enabled],
    },
  ];
}

export function buildTaskInboxContextMenu(_studio: Studio, metadata: TaskInboxContextMetadata): Menu {
  const { engineId, task, columnId, cellValue } = metadata;

  const filterEntry: Menu =
    columnId && cellValue && TASK_INBOX_FILTERABLE_COLUMNS[columnId]
      ? [
          {
            type: 'command' as const,
            id: `engine-workspace/task-inbox/use-as-filter-${columnId}`,
            label: `Use "${truncateForMenu(cellValue)}" as ${TASK_INBOX_FILTERABLE_COLUMNS[columnId]} Filter`,
            icon: 'ph ph-funnel',
            command: 'engine.workspace.taskInbox.applyColumnFilter',
            commandArgs: [columnId, cellValue],
          },
          { type: 'divider' as const },
        ]
      : [];

  return [
    ...filterEntry,
    {
      type: 'command',
      id: 'engine-workspace/task-inbox/open-debugger',
      label: 'Open in Debugger',
      icon: 'ph ph-bug',
      command: 'engine.debugger.focusOrOpen',
      commandArgs: [engineId, task.processInstanceId],
    },
    { type: 'divider' },
    {
      type: 'command',
      id: 'engine-workspace/task-inbox/complete',
      label: 'Complete Task',
      icon: 'ph ph-check-circle',
      command: 'engine.workspace.taskInbox.completeSingle',
      commandArgs: [engineId, task.id],
    },
  ];
}
