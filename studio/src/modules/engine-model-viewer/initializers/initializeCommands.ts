import type { Bifrost } from '#bifrost/Bifrost';
import type { CommandContext } from '#bifrost/contracts/CommandTypes';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import {
  getImageFormatForFilename,
  IMAGE_SAVE_DIALOG_FILTERS,
  renderSvgToRasterImage,
  runWithExportHint,
  SUPPORTED_IMAGE_EXTENSIONS_TEXT,
} from '#modules/bpmn-core/ImageExportFunctions';
import type { EngineConnectionManager } from '#modules/engine-core';
import { ENGINE_COMMANDS } from '#modules/engine-core';
import { is } from 'bpmn-js/lib/util/ModelUtil';

import type { StartResult } from '@elraptorus/bfw_engine_sdk';

import { MODEL_VIEWER_COMMANDS } from '../commands/ModelViewerCommands';
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

  bifrost.commands.register(MODEL_VIEWER_COMMANDS.exportImage, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<ModelViewerDocumentModel>(editorDocument);
    const svg = await model.exportSvg();
    if (!svg) {
      bifrost.notifications.open({
        type: 'warning',
        content: 'Could not export the image — canvas not ready.',
        source: 'Engine',
      });
      return;
    }

    const filename = await bifrost.dialog.showSaveFile({
      title: 'Export as image',
      defaultPath: `${model.getProcessModelId()}.png`,
      filters: IMAGE_SAVE_DIALOG_FILTERS,
    });
    if (filename == null || filename.trim() === '') {
      return;
    }

    const format = getImageFormatForFilename(filename);
    if (format == null) {
      bifrost.notifications.open({
        type: 'error',
        content: `Cannot export to '${filename}'. Choose a file name ending in ${SUPPORTED_IMAGE_EXTENSIONS_TEXT}.`,
        source: 'Engine',
      });
      return;
    }

    const fileContent =
      format === 'svg' ? svg : await runWithExportHint(bifrost.dialog, async () => renderSvgToRasterImage(svg, format));
    await bifrost.files.save(bifrost.files.getUriForFilename(filename), fileContent);
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

  function downloadTextFile(content: string, fileName: string, mimeType = 'text/plain'): void {
    const blob = new Blob([content], { type: mimeType });
    downloadBlob(blob, fileName);
  }

  function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

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
      if (element == null || !is(element, 'bpmn:SubProcess')) {
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
      await bifrost.commands.executeCommand(MODEL_VIEWER_COMMANDS.exportImage, [editorDocument]);
    },
  );
}
