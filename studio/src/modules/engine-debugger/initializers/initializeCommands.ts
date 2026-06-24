import type { Bifrost } from '#bifrost/Bifrost';
import { removeMultilineIndent } from '#bifrost/common/StringFunctions';
import type { EngineConnectionManager, RetryContext, RetryResult } from '#modules/engine-core';
import { ENGINE_COMMANDS, getHumanizedDateTime, getShortId } from '#modules/engine-core';
import type { FlowNodeInstance, ProcessInstance } from '@elraptorus/daemonengine_sdk';
import { FlowNodeType } from '@elraptorus/daemonengine_sdk';
import * as json5 from 'json5';

import type {
  DialogContent,
  DialogOptions,
  DialogResult,
  DialogValidationResult,
  EditorDocument,
} from '@evil/bifrost_fw_sdk';
import { StandardDialogResponse, assertNotNull, getUrlForOpenInNewTab } from '@evil/bifrost_fw_sdk';
import type { QuickJumpItem } from '@evil/bifrost_fw_sdk/types/contracts';

import { DataObjectDetailLevel } from '../../bpmn-core/DataObjectDetailsSettings';
import { DMN_TRACE_DOCUMENT_TYPE, ENGINE_DEBUGGER_DOCUMENT_TYPE } from '../Constants';
import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import type { DmnTraceFragmentModel } from '../dmn-trace/DmnTraceFragmentModel';
import { getCustomPropertyFromViewer } from '../libs/BpmnCustomPropertyAccessor';
import { renderToPng, renderToSvg } from '../libs/BpmnExportFunctions';
import { getUserTaskFormSchema } from '../libs/BpmnFlowNodeAccessors';
import { getFlowNodeById } from '../libs/BpmnProcessHelpers';
import { createCsvExportString } from '../libs/CsvExportHelper';
import type { FlowNode } from '../libs/SelectableElement';
import { resolveFlowNodeIconForDebugger } from '../libs/flowNodeDisplay';

function resolveEngineConnection(connectionManager: EngineConnectionManager, engineIdOrUrl: string) {
  return connectionManager.getConnection(engineIdOrUrl) ?? connectionManager.getConnectionByUrl(engineIdOrUrl);
}

function isEngineOnline(connectionManager: EngineConnectionManager, engineIdOrUrl: string): boolean {
  return resolveEngineConnection(connectionManager, engineIdOrUrl)?.state === 'connected';
}

function getEngineClient(connectionManager: EngineConnectionManager, engineIdOrUrl: string) {
  return resolveEngineConnection(connectionManager, engineIdOrUrl)?.client ?? null;
}

export default function initializeCommands(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  bifrost.commands.register(
    'engine.debugger.workbench.openOrFocusInspector',
    () => {
      bifrost.panes.setVisibilityOfPaneAreaByPaneId('inspectors/editor_document_inspector', true);
    },
    {
      visibleInSearch: true,
      description: ['Debugger: Open Inspector', 'Debugger: Show Inspector', 'Debugger: Toggle Inspector'],
      enabledWhen: () => {
        const focussedDocument = bifrost.editors.getFocusedEditorDocument();

        return focussedDocument?.documentType === ENGINE_DEBUGGER_DOCUMENT_TYPE;
      },
    },
  );

  bifrost.commands.register(
    'engine.debugger.workbench.openAndFocusExpressionRunner',
    async () => {
      bifrost.panes.setVisibilityOfPaneAreaByPaneId('inspectors/editor_document_inspector', true);

      const treeview = await bifrost.views.waitForAndGetById('debuggerInspector');
      await treeview.waitForAndSelectEntriesByMetadataFilter(
        (metadata) => metadata.action === 'show-expression-runner',
      );

      const expressionRunnerEntry = document.querySelector(
        treeview.domSelector + ' .treeview__entry--selected',
      ) as HTMLElement | null;
      expressionRunnerEntry?.click();

      const oneLineCodeEditor = document.getElementById(
        'debugger-expression-runner-expression-input',
      ) as HTMLElement | null;

      const focusEvent = new FocusEvent('focus', { relatedTarget: oneLineCodeEditor });
      oneLineCodeEditor?.dispatchEvent(focusEvent);
    },
    {
      visibleInSearch: true,
      description: ['Debugger: Open Expression Runner', 'Debugger: Show Expression Runner'],
      enabledWhen: () => {
        const focussedDocument = bifrost.editors.getFocusedEditorDocument();

        return focussedDocument?.documentType === ENGINE_DEBUGGER_DOCUMENT_TYPE;
      },
    },
  );

  bifrost.commands.register(
    'engine.debugger.settings',
    () => {
      bifrost.commands.executeCommand('std.settings.openUserSettingsAtCategory', ['Engine Debugger']);
    },
    {
      visibleInSearch: true,
      description: ['Debugger: Open Settings', 'Debugger: Show Settings'],
      enabledWhen: () => {
        const focussedDocument = bifrost.editors.getFocusedEditorDocument();

        return focussedDocument?.documentType === ENGINE_DEBUGGER_DOCUMENT_TYPE;
      },
    },
  );

  bifrost.commands.register(
    'engine.debugger.toggleDocumentationDisplay',
    () => {
      const currentSetting = bifrost.settings.get('engineDebugger.viewer.showDocumentationMarker');
      bifrost.settings.set('engineDebugger.viewer.showDocumentationMarker', !currentSetting);
    },
    {
      visibleInSearch: true,
      description: ['Debugger: Toggle Show Documentation Marker', 'Debugger: Toggle display of Documentation Marker'],
    },
  );

  bifrost.commands.register(
    'engine.debugger.startSettingDataObjectDetailLevel',
    () => bifrost.commands.executeCommand('engine.debugger.showDataObjectDetailLevels'),
    { visibleInSearch: true, description: ['Debugger: Set Data Object Detail Level'] },
  );

  bifrost.commands.register('engine.debugger.showDataObjectDetailLevels', () => {
    bifrost.quickJump.show({
      prompt: 'Debugger: Set Data Object Detail Level ...',
      entries: [
        {
          type: 'command',
          label: 'Show everything',
          command: 'engine.debugger.setDataObjectDetailLevel',
          commandArgs: [DataObjectDetailLevel.showAll],
        },
        {
          type: 'command',
          label: 'Hide input associations',
          command: 'engine.debugger.setDataObjectDetailLevel',
          commandArgs: [DataObjectDetailLevel.hideInputAssociations],
        },
        {
          type: 'command',
          label: 'Hide all associations',
          command: 'engine.debugger.setDataObjectDetailLevel',
          commandArgs: [DataObjectDetailLevel.hideAllAssociations],
        },
        {
          type: 'command',
          label: 'Hide everything',
          command: 'engine.debugger.setDataObjectDetailLevel',
          commandArgs: [DataObjectDetailLevel.hideAll],
        },
      ],
    });
  });

  bifrost.commands.register('engine.debugger.setDataObjectDetailLevel', (newLevel) => {
    bifrost.settings.set('engineDebugger.viewer.dataObjectDetailLevel', newLevel);
  });

  bifrost.commands.register(
    'engine.debugger.showAllInstancesWithBusinessKey',
    async (engineIdOrUrl: string, businessKey: string) => {
      const connection = resolveEngineConnection(connectionManager, engineIdOrUrl);
      const engineId = connection?.engineId ?? engineIdOrUrl;
      await bifrost.commands.executeCommand('engine.workspace.openInstanceSearch', [
        engineId,
        { businessKey: businessKey },
      ]);
    },
    { enabledWhen: (engineIdOrUrl: string) => isEngineOnline(connectionManager, engineIdOrUrl) },
  );

  bifrost.commands.register(
    'engine.debugger.toggleMultipleOutgoingSequenceFlowsDisplay',
    async () => {
      const currentSetting = bifrost.settings.get('engineDebugger.viewer.showMultipleOutgoingSequenceFlowsMarkers');
      bifrost.settings.set('engineDebugger.viewer.showMultipleOutgoingSequenceFlowsMarkers', !currentSetting);
    },
    {
      visibleInSearch: true,
      description: [
        'Debugger: Toggle Multiple Outgoing Sequence Flows Markers',
        'Debugger: Toggle display of multiple outgoing Sequence Flows Markers',
      ],
    },
  );

  bifrost.commands.register(
    'engine.debugger.open.chooseProcessInstanceFromList',
    async (engineUrl: string, flowNodeInstances: FlowNodeInstance[]) => {
      const flowNodeInstanceLinks: QuickJumpItem[] = flowNodeInstances.map((instance) => {
        const formattedStartDate = instance.startedAt ? getHumanizedDateTime(new Date(instance.startedAt)) : '';
        const flowNodeName = instance.flowNodeId ?? instance.flowNodeId;
        const icon = resolveFlowNodeIconForDebugger(instance.flowNodeType, instance.eventType);

        return {
          icon: icon,
          type: 'command',
          label: flowNodeName,
          sublabel: `${formattedStartDate} - ${getShortId(instance.id)}`,
          command: 'engine.debugger.goToEventParticipant',
          commandArgs: [engineUrl, instance.processInstanceId, instance.id],
        };
      });

      bifrost.quickJump.show({
        prompt: 'Select Event Receiver ...',
        entries: flowNodeInstanceLinks,
      });
    },
  );

  bifrost.commands.register(
    'engine.debugger.restartProcessInstance',
    async (engineIdOrUrl: string, processInstanceToReRun: ProcessInstance) => {
      const connection = resolveEngineConnection(connectionManager, engineIdOrUrl);
      const engineId = connection?.engineId ?? engineIdOrUrl;
      const client = getEngineClient(connectionManager, engineIdOrUrl);
      if (!client || !processInstanceToReRun.processModelId) {
        return;
      }

      const restoreData =
        (processInstanceToReRun.startedWithContext as Record<string, unknown> | undefined) ?? undefined;
      const startResult = await client.processes.start(processInstanceToReRun.processModelId, {
        businessKey: processInstanceToReRun.businessKey ?? undefined,
        payload: restoreData,
        context: restoreData,
      } as Parameters<typeof client.processes.start>[1]);

      bifrost.commands.executeCommand('engine.debugger.focusOrOpen', [engineId, startResult.processInstanceId]);
    },
    {
      enabledWhen: (engineIdOrUrl: string, processInstanceToReRun: ProcessInstance) =>
        isEngineOnline(connectionManager, engineIdOrUrl) &&
        Boolean(processInstanceToReRun) &&
        Boolean(processInstanceToReRun.processModelId),
    },
  );

  bifrost.commands.register(
    'engine.debugger.goToParentProcessInstance',
    async (engineIdOrUrl: string, processInstanceId: string) => {
      const connection = resolveEngineConnection(connectionManager, engineIdOrUrl);
      const engineId = connection?.engineId ?? engineIdOrUrl;
      await bifrost.commands.executeCommand('engine.debugger.focusOrOpen', [engineId, processInstanceId]);
    },
    { enabledWhen: (engineIdOrUrl: string): boolean => isEngineOnline(connectionManager, engineIdOrUrl) },
  );

  bifrost.commands.register(
    'engine.debugger.goToEventParticipant',
    async (engineIdOrUrl: string, processInstanceId: string, id: string) => {
      const client = getEngineClient(connectionManager, engineIdOrUrl);
      if (!client) {
        throw new Error('Engine not connected');
      }
      try {
        await client.graphql.getProcessInstance(processInstanceId, { fields: ['id'] });
      } catch {
        throw new Error(`Could not find Process Instance "${processInstanceId}" on target Engine.`);
      }
      const connection = resolveEngineConnection(connectionManager, engineIdOrUrl);
      const engineId = connection?.engineId ?? engineIdOrUrl;
      await bifrost.commands.executeCommand('engine.debugger.focusOrOpen', [engineId, processInstanceId, id]);
    },
    { enabledWhen: (engineIdOrUrl: string): boolean => isEngineOnline(connectionManager, engineIdOrUrl) },
  );

  bifrost.commands.register(
    'engine.debugger.focusOrOpen',
    async (engineIdOrUrl: string, processInstanceId: string, preselectFlowNodeInstance?: string) => {
      const connection = resolveEngineConnection(connectionManager, engineIdOrUrl);
      const engineId = connection?.engineId ?? engineIdOrUrl;
      const targetUrl = `engine-debug://${engineId}/${processInstanceId}`;
      const debuggerDocument = bifrost.editors.focusOrOpenEditorDocument(targetUrl);

      if (preselectFlowNodeInstance) {
        const model =
          await bifrost.editors.getEditorDocumentModel<EngineBpmnDebuggerEditorDocumentModel>(debuggerDocument);
        model.onceInteractive(() => {
          model.navigateToFlowNodeInstance(preselectFlowNodeInstance);
        });
      }
    },
    { enabledWhen: (engineIdOrUrl: string): boolean => isEngineOnline(connectionManager, engineIdOrUrl) },
  );

  bifrost.commands.register(`engine.debugger.refresh`, async (model: EngineBpmnDebuggerEditorDocumentModel) =>
    model.refresh(),
  );

  bifrost.commands.register(
    'engine.debugger.retryWithConfirmation',
    async (
      model: EngineBpmnDebuggerEditorDocumentModel,
      resetOptions?: { resetToFlowNodeInstanceId: string; flowNodeName?: string },
    ) => {
      if (!model.processInstance) {
        return;
      }

      const context: RetryContext = {
        processModelId: model.processInstance.processModelId,
        currentVersion: model.processInstance.version,
      };

      if (resetOptions?.resetToFlowNodeInstanceId) {
        context.resetToFlowNodeInstanceId = resetOptions.resetToFlowNodeInstanceId;
      }
      if (resetOptions?.flowNodeName) {
        context.flowNodeName = resetOptions.flowNodeName;
      }

      const result: RetryResult | null = await bifrost.commands.executeCommand(
        ENGINE_COMMANDS.configuredRetryProcessInstance,
        [model.engineId, model.processInstance.id, context],
      );

      if (result?.retried) {
        await model.refresh();
      }
    },
    {
      enabledWhen: (model: EngineBpmnDebuggerEditorDocumentModel): boolean =>
        isEngineOnline(connectionManager, model.engineId),
    },
  );

  bifrost.commands.register(
    'engine.debugger.continueInteractiveTask',
    async (model: EngineBpmnDebuggerEditorDocumentModel, flowNode: FlowNode, id: string) => {
      if (flowNode.flowNodeInstances.length === 0) {
        return;
      }

      switch (flowNode.flowNodeModel?.type) {
        case FlowNodeType.UserTask:
          return bifrost.commands.executeCommand('engine.debugger.taskView.focusOrOpen', [
            model,
            flowNode.flowNodeInstances.find((fni) => fni.id === id),
          ]);
        case FlowNodeType.ManualTask:
        case FlowNodeType.Task:
          return;
      }
      throw new Error(`Invalid BpmnType ${flowNode.flowNodeModel?.type} for interactive task ${id}.`);
    },
    {
      enabledWhen: (model: EngineBpmnDebuggerEditorDocumentModel): boolean =>
        isEngineOnline(connectionManager, model.engineId),
    },
  );

  bifrost.commands.register(
    'engine.debugger.triggerMessageEvent',
    async (model: EngineBpmnDebuggerEditorDocumentModel, messageName: string, flowNodeInstance: FlowNodeInstance) => {
      assertNotNull(model.processInstance, 'model.processInstance');

      const dialogResult = await askMessageTriggerConfirmation(model, flowNodeInstance, messageName);
      if (!dialogResult) {
        return;
      }

      bifrost.commands.executeCommand(ENGINE_COMMANDS.triggerMessage, [
        model.engineId,
        messageName,
        dialogResult.payload ?? {},
        { processInstanceId: flowNodeInstance?.processInstanceId ?? model.processInstance.id },
      ]);
    },
    {
      enabledWhen: (model: EngineBpmnDebuggerEditorDocumentModel): boolean =>
        isEngineOnline(connectionManager, model.engineId),
    },
  );

  bifrost.commands.register(
    'engine.debugger.triggerSignalEvent',
    async (model: EngineBpmnDebuggerEditorDocumentModel, signalName: string, _flowNodeInstance: FlowNodeInstance) => {
      assertNotNull(model.processInstance, 'model.processInstance');

      const dialogResult = await askSignalTriggerConfirmation(signalName);
      if (!dialogResult) {
        return;
      }

      bifrost.commands.executeCommand(ENGINE_COMMANDS.triggerSignal, [model.engineId, signalName]);
    },
    {
      enabledWhen: (model: EngineBpmnDebuggerEditorDocumentModel): boolean =>
        isEngineOnline(connectionManager, model.engineId),
    },
  );

  bifrost.commands.register(
    'engine.debugger.triggerTimerEvent',
    async (model: EngineBpmnDebuggerEditorDocumentModel, flowNodeInstance: FlowNodeInstance) => {
      const timerName = flowNodeInstance.flowNodeId ?? flowNodeInstance.flowNodeId;
      const dialogResult = await askTimerTriggerConfirmation(timerName);
      if (!dialogResult) {
        return;
      }

      bifrost.commands.executeCommand(ENGINE_COMMANDS.triggerTimerEvent, [model.engineId, flowNodeInstance.id]);
    },
    {
      enabledWhen: (model: EngineBpmnDebuggerEditorDocumentModel): boolean =>
        isEngineOnline(connectionManager, model.engineId),
    },
  );

  async function askMessageTriggerConfirmation(
    model: EngineBpmnDebuggerEditorDocumentModel,
    flowNodeInstance: FlowNodeInstance,
    messageName: string,
  ): Promise<{ payload: Record<string, unknown> | undefined } | null> {
    const examplePayload =
      getCustomPropertyFromViewer(
        model.bpmnViewerComponentAdapter,
        flowNodeInstance.flowNodeId,
        'studio.examplePayload',
      ) ?? undefined;

    const dialogResult = await bifrost.dialog.open(
      {
        title: `Trigger Message Event "${messageName}"`,
        content: getMessageEventDialogContent(examplePayload),
        actions: [
          { label: 'Cancel', response: StandardDialogResponse.Cancel, cancel: true },
          { label: 'Trigger Message', response: StandardDialogResponse.Submit, default: true },
        ],
      },
      async (dialogResultToValidate: DialogResult): Promise<DialogValidationResult> => {
        if (dialogResultToValidate.wasCancelled || dialogResultToValidate.response === 'cancel') {
          return { closeDialog: true };
        }

        const payloadText = dialogResultToValidate.formData?.payload?.trim() ?? '';
        if (payloadText.length > 0) {
          try {
            const result = json5.parse(payloadText);
            if (typeof result !== 'object') {
              throw new Error(`Given payload is of type ${typeof result}`);
            }
          } catch {
            return {
              closeDialog: false,
              validationErrors: [{ contentId: 'payload', errorLabel: 'Must be a valid JSON object' }],
            };
          }
        }

        return { closeDialog: true };
      },
    );

    if (dialogResult.wasCancelled || dialogResult.response === 'cancel') {
      return null;
    }

    const submittedPayload = dialogResult.formData?.payload?.trim() ?? '';
    const payload = submittedPayload.length > 0 ? json5.parse(submittedPayload) : undefined;
    return { payload };
  }

  async function askSignalTriggerConfirmation(signalName: string): Promise<true | null> {
    const dialogResult = await bifrost.dialog.open({
      title: `Trigger Signal Event "${signalName}"`,
      content: [
        {
          type: 'markdown',
          text: removeMultilineIndent(`**Caution:**
            The Signal will be received by **all** matching Signal Catch-, Boundary-, and Start Events across the entire engine.`),
        },
      ],
      actions: [
        { label: 'Cancel', response: StandardDialogResponse.Cancel, cancel: true },
        { label: 'Trigger Signal', response: StandardDialogResponse.Submit, default: true },
      ],
    });

    if (dialogResult.wasCancelled || dialogResult.response === 'cancel') {
      return null;
    }
    return true;
  }

  async function askTimerTriggerConfirmation(timerName: string): Promise<true | null> {
    const dialogResult = await bifrost.dialog.open({
      title: `Trigger Timer Event "${timerName}"`,
      content: [
        {
          type: 'markdown',
          text: removeMultilineIndent(`**Caution:**
            The Timer will be skipped and the process continues immediately.`),
        },
      ],
      actions: [
        { label: 'Cancel', response: StandardDialogResponse.Cancel, cancel: true },
        { label: 'Trigger Timer', response: StandardDialogResponse.Submit, default: true },
      ],
    });

    if (dialogResult.wasCancelled || dialogResult.response === 'cancel') {
      return null;
    }
    return true;
  }

  function getMessageEventDialogContent(examplePayload: string | undefined): DialogContent {
    return [
      {
        type: 'json',
        id: 'payload',
        label: 'Payload (optional)',
        value: examplePayload || '{}',
        hint: 'Example: {"hello": "world"}',
        focus: true,
        optional: true,
      },
      {
        type: 'divider',
      },
      {
        type: 'markdown',
        text: removeMultilineIndent(`**Caution:**
          The Message will be received by **all** matching Message Catch-, Boundary-, and Start Events that use the same Correlation.`),
      },
    ];
  }

  bifrost.commands.register(
    'engine.debugger.taskView.focusOrOpen',
    async (model: EngineBpmnDebuggerEditorDocumentModel, userTaskInstance?: FlowNodeInstance) => {
      if (!userTaskInstance) {
        throw new Error('Can not open TaskView for undefined UserTask.');
      }

      const taskViewerUri = getUrlForOpenInNewTab(
        'engine-debug.user-task-view',
        model.getUri(),
        `${userTaskInstance.id}-user-task-viewer`,
        {
          engineId: model.engineId,
          engineUrl: model.engineUrl,
          userTaskInstance: JSON.stringify(userTaskInstance, null, 2),
        },
      );

      bifrost.editors.focusOrOpenEditorDocument(taskViewerUri, `UserTask: ${userTaskInstance.id}`);
    },
    {
      enabledWhen: (model: EngineBpmnDebuggerEditorDocumentModel): boolean =>
        isEngineOnline(connectionManager, model.engineId),
    },
  );

  bifrost.commands.register(
    'engine.debugger.taskView.reviewCompleted',
    async (model: EngineBpmnDebuggerEditorDocumentModel, userTaskInstance?: FlowNodeInstance) => {
      if (!userTaskInstance) {
        throw new Error('Can not open TaskView review for undefined UserTask.');
      }

      const additionalData: Record<string, string> = {
        engineId: model.engineId,
        engineUrl: model.engineUrl,
        userTaskInstance: JSON.stringify(userTaskInstance, null, 2),
        readOnly: 'true',
      };

      if (model.processModel) {
        const bpmnFlowNode = getFlowNodeById(model.processModel, userTaskInstance.flowNodeId);
        const definitionFormSchema = getUserTaskFormSchema(bpmnFlowNode);
        if (definitionFormSchema != null) {
          additionalData.definitionFormSchema = JSON.stringify(definitionFormSchema);
        }
      }

      const taskViewerUri = getUrlForOpenInNewTab(
        'engine-debug.user-task-view',
        model.getUri(),
        `${userTaskInstance.id}-user-task-review`,
        additionalData,
      );

      bifrost.editors.focusOrOpenEditorDocument(taskViewerUri, `UserTask: ${getShortId(userTaskInstance.id)} (Review)`);
    },
  );

  bifrost.commands.register(
    'engine.debugger.openDmnTrace',
    (engineId: string, processInstanceId: string, flowNodeInstanceId: string) => {
      const parentUri = `engine-debug://${engineId}/${processInstanceId}`;
      const fragmentUri = getUrlForOpenInNewTab(DMN_TRACE_DOCUMENT_TYPE, parentUri, flowNodeInstanceId, {
        engineId,
        processInstanceId,
        flowNodeInstanceId,
      });
      bifrost.editors.focusOrOpenEditorDocument(fragmentUri, `DMN Trace: ${flowNodeInstanceId.substring(0, 8)}`);
    },
    { enabledWhen: (_engineId: string): boolean => true },
  );

  bifrost.commands.register(
    `std.editor.zoomToViewport.${DMN_TRACE_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnTraceFragmentModel>(editorDocument);
      model.zoomToViewport();
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToActualSize.${DMN_TRACE_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnTraceFragmentModel>(editorDocument);
      model.zoomToActualSize();
    },
  );

  bifrost.commands.register('engine.debugger.dmnTrace.viewDefinition', async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<DmnTraceFragmentModel>(editorDocument);
    const decisionRef = model.getDecisionRef();
    if (decisionRef) {
      bifrost.commands.executeCommand('engine.workspace.openDecisionViewer', [model.engineId, decisionRef]);
    }
  });

  bifrost.commands.register('engine.debugger.toggleAutoFollow', () =>
    bifrost.settings.set('engineDebugger.viewer.autoFollow', !bifrost.settings.get('engineDebugger.viewer.autoFollow')),
  );

  bifrost.commands.register(
    `std.editor.zoomToActualSize.${ENGINE_DEBUGGER_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const EngineBpmnDebuggerEditorDocumentModel =
        await bifrost.editors.getEditorDocumentModel<EngineBpmnDebuggerEditorDocumentModel>(editorDocument);

      if (EngineBpmnDebuggerEditorDocumentModel.isReadyForInteraction) {
        EngineBpmnDebuggerEditorDocumentModel.setZoom(1);
      }
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToViewport.${ENGINE_DEBUGGER_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const EngineBpmnDebuggerEditorDocumentModel =
        await bifrost.editors.getEditorDocumentModel<EngineBpmnDebuggerEditorDocumentModel>(editorDocument);

      if (EngineBpmnDebuggerEditorDocumentModel.isReadyForInteraction) {
        EngineBpmnDebuggerEditorDocumentModel.zoomToViewport();
      }
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToSelectedElement.${ENGINE_DEBUGGER_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const EngineBpmnDebuggerEditorDocumentModel =
        await bifrost.editors.getEditorDocumentModel<EngineBpmnDebuggerEditorDocumentModel>(editorDocument);

      if (!EngineBpmnDebuggerEditorDocumentModel.isReadyForInteraction) {
        return;
      }

      const element = EngineBpmnDebuggerEditorDocumentModel.selectedElements[0] as any;
      const elementId = element?.dataObjectId ?? element?.flowNodeId ?? element?.id;

      if (elementId != null) {
        EngineBpmnDebuggerEditorDocumentModel.zoomToElements([elementId]);
      }
    },
  );

  bifrost.commands.register('engine.debugger.downloadBpmn', async (model: EngineBpmnDebuggerEditorDocumentModel) => {
    assertNotNull(model.processInstance, 'model.processInstance');
    assertNotNull(model.processInstance.xml, 'model.processInstance.xml');

    const filePath = await bifrost.dialog.showSaveFile({
      defaultPath: `ProcessInstance_${model.processInstance.id}.bpmn`,
      filters: [{ name: 'BPMN', extensions: ['bpmn'] }],
    });

    if (!filePath || filePath.trim().length === 0) {
      return;
    }

    await exportDebuggerContent(model, filePath, 'bpmn');
  });

  bifrost.commands.register(
    `std.editor.showExportDialog.${ENGINE_DEBUGGER_DOCUMENT_TYPE}`,
    async (model?: EngineBpmnDebuggerEditorDocumentModel) => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocument, 'editorDocument');

      if (!model) {
        model = await bifrost.editors.getEditorDocumentModel(editorDocument);
      }

      const dialogOptions: DialogOptions = {
        title: 'Export Process Instance Data',
        content: [
          {
            type: 'response_link',
            label: 'PNG',
            sublabel: 'Take a Picture of the Process Instance',
            icon: 'ph-duotone ph-palette icon-export-as-png',
            response: 'png',
          },
          {
            type: 'response_link',
            label: 'SVG',
            response: 'svg',
          },
          {
            type: 'response_link',
            label: 'CSV',
            sublabel: 'For use with Excel',
            icon: 'ph-duotone ph-file-csv icon-spreadsheet',
            response: 'csv',
          },
          {
            type: 'response_link',
            label: 'JSON',
            sublabel: 'Raw JSON data',
            icon: 'ph-duotone ph-brackets-curly',
            response: 'json',
          },
        ],
        actions: [],
      };

      const dialogResult = await bifrost.dialog.open(dialogOptions);
      if (dialogResult.wasCancelled) {
        return;
      }
      assertNotNull(dialogResult.response, 'dialog.response');

      switch (dialogResult.response) {
        case 'svg':
          return bifrost.commands.executeCommand('engine.debugger.workbench.exportAsSvg', [model]);
        case 'png':
          return bifrost.commands.executeCommand('engine.debugger.workbench.exportAsPng', [model]);
        case 'csv':
          return bifrost.commands.executeCommand('engine.debugger.workbench.exportAsCsv', [model]);
        case 'json':
          return bifrost.commands.executeCommand('engine.debugger.workbench.exportAsJson', [model]);
        default:
          throw new Error(`Invalid export format: ${dialogResult.response}`);
      }
    },
    {
      enabledWhen: (model: EngineBpmnDebuggerEditorDocumentModel) => {
        if (!model) {
          return true;
        }

        return isEngineOnline(connectionManager, model.engineUrl) && model.processInstance != null;
      },
    },
  );

  bifrost.commands.register(
    `std.editor.reexportFile.${ENGINE_DEBUGGER_DOCUMENT_TYPE}`,
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      assertNotNull(editorDocument, 'editorDocument');

      const model = await bifrost.editors.getEditorDocumentModel<EngineBpmnDebuggerEditorDocumentModel>(editorDocument);

      const localStorage = bifrost.getLocalStorage('document-exports');

      const storedDocumentExportSettings = localStorage.load() ?? {};
      const settingsForDocument = storedDocumentExportSettings[editorDocument.uri];

      await writeToFile(model, settingsForDocument.targetFileUri, settingsForDocument.format);
    },
    {
      enabledWhen: () => {
        const editorDocument = bifrost.editors.getFocusedEditorDocument();

        const localStorage = bifrost.getLocalStorage('document-exports');

        const storedDocumentExportSettings = localStorage.load() ?? {};

        return editorDocument != null && storedDocumentExportSettings[editorDocument.uri] != null;
      },
    },
  );

  // TODO - Not included with the export dialog, because overlays are not yet included with this type of export.
  bifrost.commands.register(
    'engine.debugger.workbench.exportAsSvg',
    async (model: EngineBpmnDebuggerEditorDocumentModel) => {
      assertNotNull(model.processInstance, 'model.processInstance');
      assertNotNull(model.processInstance.xml, 'model.processInstance.xml');

      const filePath = await bifrost.dialog.showSaveFile({
        defaultPath: `ProcessInstance_${model.processInstance.id}.svg`,
        filters: [{ name: 'SVG', extensions: ['svg'] }],
      });

      if (!filePath || filePath.trim().length === 0) {
        return;
      }

      await exportDebuggerContent(model, filePath, 'svg');
    },
  );

  bifrost.commands.register(
    'engine.debugger.workbench.exportAsPng',
    async (model: EngineBpmnDebuggerEditorDocumentModel) => {
      assertNotNull(model.processInstance, 'model.processInstance');
      assertNotNull(model.processInstance.xml, 'model.processInstance.xml');

      const filePath = await bifrost.dialog.showSaveFile({
        defaultPath: `ProcessInstance_${model.processInstance.id}.png`,
        filters: [{ name: 'PNG', extensions: ['png'] }],
      });

      if (!filePath || filePath.trim().length === 0) {
        return;
      }

      exportDebuggerContent(model, filePath, 'png');
    },
  );

  bifrost.commands.register(
    'engine.debugger.workbench.exportAsCsv',
    async (model: EngineBpmnDebuggerEditorDocumentModel) => {
      assertNotNull(model.processInstance, 'model.processInstance');

      const filePath = await bifrost.dialog.showSaveFile({
        defaultPath: `ProcessInstance_${model.processInstance.id}.csv`,
        filters: [{ name: 'Excel Files (*.csv)', extensions: ['csv'] }],
      });

      if (!filePath || filePath.trim().length === 0) {
        return;
      }

      await exportDebuggerContent(model, filePath, 'csv');
    },
  );

  bifrost.commands.register(
    'engine.debugger.workbench.exportAsJson',
    async (model: EngineBpmnDebuggerEditorDocumentModel) => {
      assertNotNull(model.processInstance, 'model.processInstance');

      const filePath = await bifrost.dialog.showSaveFile({
        defaultPath: `ProcessInstance_${model.processInstance.id}.json`,
        filters: [{ name: 'JSON Files (*.json)', extensions: ['json'] }],
      });

      if (!filePath || filePath.trim().length === 0) {
        return;
      }

      await exportDebuggerContent(model, filePath, 'json');
    },
  );

  async function exportDebuggerContent(
    model: EngineBpmnDebuggerEditorDocumentModel,
    filePath: string,
    format: string,
  ): Promise<void> {
    const editorDocument = bifrost.editors.getFocusedEditorDocument();
    assertNotNull(editorDocument, 'editorDocument');

    const localFileName = bifrost.files.getUriForFilename(filePath);

    await writeToFile(model, localFileName, format);

    const localStorage = bifrost.getLocalStorage('document-exports');

    const documentExportHistory = localStorage.load() ?? {};

    documentExportHistory[editorDocument.uri] = {
      targetFileUri: localFileName,
      format: format,
    };

    localStorage.save(documentExportHistory);
  }

  async function writeToFile(
    model: EngineBpmnDebuggerEditorDocumentModel,
    localFileName: string,
    format: string,
  ): Promise<void> {
    const formatters = {
      svg: async () => renderToSvg(model),
      png: async () => renderToPng(model, bifrost.dialog),
      bpmn: () => model.processInstance?.xml,
      csv: async () => createCsvExportString(model),
      json: () =>
        JSON.stringify(
          {
            ...model.processInstance,
            flowNodeInstances: model.flowNodeInstances,
          },
          null,
          2,
        ),
    };

    const exportFileContent = await formatters[format]();

    await bifrost.files.save(localFileName, exportFileContent);
  }
}
