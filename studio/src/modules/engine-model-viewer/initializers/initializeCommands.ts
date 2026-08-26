import type { Bifrost } from '#bifrost/Bifrost';
import type { CommandContext } from '#bifrost/contracts/CommandTypes';
import type { DialogOptions } from '#bifrost/contracts/DialogTypes';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { EngineConnectionManager } from '#modules/engine-core';
import { ENGINE_COMMANDS } from '#modules/engine-core';
import type { StartResult } from '@elraptorus/daemonengine_sdk';

import { MODEL_VIEWER_COMMANDS } from '../commands/ModelViewerCommands';
import { downloadBlob, downloadTextFile } from '../helpers/downloadFile';
import type { ModelViewerDocumentModel } from '../models/ModelViewerDocumentModel';

export default function initializeCommands(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  bifrost.commands.register(MODEL_VIEWER_COMMANDS.refresh, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<ModelViewerDocumentModel>(editorDocument);
    await model.refresh();
  });

  bifrost.commands.register(MODEL_VIEWER_COMMANDS.fit, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<ModelViewerDocumentModel>(editorDocument);
    model.zoomToViewport();
  });

  bifrost.commands.register(MODEL_VIEWER_COMMANDS.zoomActualSize, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<ModelViewerDocumentModel>(editorDocument);
    model.zoomToActualSize();
  });

  bifrost.commands.register(MODEL_VIEWER_COMMANDS.exportPng, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<ModelViewerDocumentModel>(editorDocument);
    const blob = await model.exportPng(2);
    if (blob.size === 0) {
      bifrost.notifications.open({
        type: 'warning',
        content: 'Could not export PNG — canvas not ready.',
        source: 'Engine',
      });
      return;
    }
    downloadBlob(blob, `${model.getProcessModelId()}.png`);
  });

  bifrost.commands.register(MODEL_VIEWER_COMMANDS.exportSvg, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<ModelViewerDocumentModel>(editorDocument);
    const svg = await model.exportSvg();
    if (!svg) {
      bifrost.notifications.open({
        type: 'warning',
        content: 'Could not export SVG — canvas not ready.',
        source: 'Engine',
      });
      return;
    }
    downloadTextFile(svg, `${model.getProcessModelId()}.svg`, 'image/svg+xml');
  });

  bifrost.commands.register(MODEL_VIEWER_COMMANDS.downloadXml, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<ModelViewerDocumentModel>(editorDocument);
    const xml = model.getXml();
    if (!xml) {
      bifrost.notifications.open({
        type: 'warning',
        content: 'No BPMN XML available for download.',
        source: 'Engine',
      });
      return;
    }
    downloadTextFile(xml, `${model.getProcessModelId()}.bpmn`, 'application/xml');
  });

  bifrost.commands.register(
    MODEL_VIEWER_COMMANDS.startProcessAtStartEvent,
    async (context: CommandContext, engineId: string, processModelId: string, startEventId: string) => {
      const useConfiguredStart = context?.type === 'mouse' && context.mouseEvent?.shiftKey;

      if (useConfiguredStart) {
        const result: StartResult | undefined = await bifrost.commands.executeCommand(
          ENGINE_COMMANDS.configuredStartProcessAndOpenDebugger,
          [engineId, processModelId],
        );
        return result;
      }

      const result: StartResult = await bifrost.commands.executeCommand(ENGINE_COMMANDS.startProcess, [
        engineId,
        processModelId,
        { startEventId },
      ]);
      await bifrost.commands.executeCommand('engine.debugger.focusOrOpen', [engineId, result.processInstanceId]);
    },
    { expectsContext: true, enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    MODEL_VIEWER_COMMANDS.openCallActivityTarget,
    async (engineId: string, targetProcessModelId: string) => {
      const targetUri = `engine-model://${engineId}/${targetProcessModelId}`;
      bifrost.editors.focusOrOpenEditorDocument(targetUri, targetProcessModelId);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  const MODEL_VIEWER_DOCUMENT_TYPE = 'engine-model-viewer';

  bifrost.commands.register(
    MODEL_VIEWER_COMMANDS.drillDown,
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument == null || editorDocument.documentType !== MODEL_VIEWER_DOCUMENT_TYPE) {
        return;
      }
      const model = await bifrost.editors.getEditorDocumentModel<ModelViewerDocumentModel>(editorDocument);
      const adapter = model.getViewerAdapter();
      if (!adapter) {
        return;
      }
      const selection = adapter.getSelection();
      const selected = selection.get();
      if (selected.length !== 1) {
        return;
      }
      const element = selected[0] as any;
      if (element?.type !== 'bpmn:SubProcess') {
        return;
      }
      const canvas = adapter.getCanvas();
      const planeId = `${element.id}_plane`;
      const targetRoot = canvas.findRoot(planeId);
      if (targetRoot != null) {
        canvas.setRootElement(targetRoot);
      }
    },
    {
      visibleInSearch: true,
      description: ['Model Viewer: Drill into subprocess', 'Model Viewer: Enter subprocess'],
    },
  );

  bifrost.commands.register(
    MODEL_VIEWER_COMMANDS.drillUp,
    async () => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (editorDocument == null || editorDocument.documentType !== MODEL_VIEWER_DOCUMENT_TYPE) {
        return;
      }
      const model = await bifrost.editors.getEditorDocumentModel<ModelViewerDocumentModel>(editorDocument);
      if (!model.isInsideSubprocessPlane()) {
        return;
      }
      const adapter = model.getViewerAdapter();
      if (!adapter) {
        return;
      }
      const canvas = adapter.getCanvas();
      const rootElement = canvas.getRootElement();
      const subprocessId = rootElement?.businessObject?.id;
      if (subprocessId == null) {
        return;
      }
      const elementRegistry = adapter.getElementRegistry();
      const subprocessShape = elementRegistry.get(subprocessId) as any;
      if (subprocessShape?.parent != null) {
        canvas.setRootElement(subprocessShape.parent);
      }
    },
    {
      visibleInSearch: true,
      description: ['Model Viewer: Return to parent plane', 'Model Viewer: Exit subprocess'],
    },
  );

  bifrost.commands.register(
    'std.editor.showExportDialog.engine-model-viewer',
    async (editorDocument: EditorDocument) => {
      const dialogOptions: DialogOptions = {
        title: 'Export BPMN as ...',
        content: [
          {
            type: 'response_link',
            label: 'SVG',
            sublabel: 'Higher quality',
            icon: 'ph-light ph-selection icon-export-as-svg',
            response: 'svg',
          },
          {
            type: 'response_link',
            label: 'PNG',
            sublabel: 'Easier to share',
            icon: 'ph-duotone ph-palette icon-export-as-png',
            response: 'png',
          },
        ],
        actions: [],
      };

      const dialogResult = await bifrost.dialog.open(dialogOptions);
      if (dialogResult.wasCancelled || dialogResult.response == null) {
        return;
      }

      const format = dialogResult.response as 'png' | 'svg';
      if (format === 'png') {
        await bifrost.commands.executeCommand(MODEL_VIEWER_COMMANDS.exportPng, [editorDocument]);
        return;
      }
      if (format === 'svg') {
        await bifrost.commands.executeCommand(MODEL_VIEWER_COMMANDS.exportSvg, [editorDocument]);
      }
    },
  );
}
