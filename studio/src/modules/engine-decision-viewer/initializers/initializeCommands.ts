import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogOptions } from '#bifrost/contracts/DialogTypes';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { EngineConnectionManager } from '#modules/engine-core';

import { DECISION_VIEWER_COMMANDS } from '../commands/DecisionViewerCommands';
import { downloadBlob, downloadTextFile } from '../helpers/downloadFile';
import type { DecisionViewerDocumentModel } from '../models/DecisionViewerDocumentModel';

export default function initializeCommands(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  bifrost.commands.register(
    DECISION_VIEWER_COMMANDS.open,
    (engineId: string, decisionModelId: string) => {
      connectionManager.setActiveEngine(engineId);
      bifrost.editors.focusOrOpenEditorDocument(`engine-decision://${engineId}/${decisionModelId}`, decisionModelId);
    },
    { visibleInSearch: true, description: ['Engine: Open Decision Viewer', 'Decision Viewer', 'View DMN Decision'] },
  );

  bifrost.commands.register(DECISION_VIEWER_COMMANDS.openImportedModel, (engineId: string, importedModelId: string) => {
    void bifrost.commands.executeCommand(DECISION_VIEWER_COMMANDS.open, [engineId, importedModelId]);
  });

  bifrost.commands.register(DECISION_VIEWER_COMMANDS.refresh, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<DecisionViewerDocumentModel>(editorDocument);
    await model.refresh();
  });

  bifrost.commands.register(DECISION_VIEWER_COMMANDS.toggleEvaluation, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<DecisionViewerDocumentModel>(editorDocument);
    model.toggleEvaluationPanel();
  });

  bifrost.commands.register(DECISION_VIEWER_COMMANDS.evaluate, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<DecisionViewerDocumentModel>(editorDocument);
    await model.evaluateDecision();
  });

  bifrost.commands.register(
    DECISION_VIEWER_COMMANDS.switchVersion,
    async (editorDocument: EditorDocument, version: string | null) => {
      const model = await bifrost.editors.getEditorDocumentModel<DecisionViewerDocumentModel>(editorDocument);
      await model.switchVersion(version);
    },
  );

  bifrost.commands.register(DECISION_VIEWER_COMMANDS.downloadXml, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<DecisionViewerDocumentModel>(editorDocument);
    const xml = model.getRawXml();
    if (!xml) {
      bifrost.notifications.open({
        type: 'warning',
        content: 'No DMN XML available for download.',
        source: 'Engine',
      });
      return;
    }
    const fileName = `${model.getDecisionModelId()}.dmn`;
    downloadTextFile(xml, fileName, 'application/xml');
  });

  bifrost.commands.register(DECISION_VIEWER_COMMANDS.exportSvg, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<DecisionViewerDocumentModel>(editorDocument);
    const svg = await model.exportSvg();
    if (!svg) {
      bifrost.notifications.open({
        type: 'warning',
        content: 'Could not export SVG — canvas not ready.',
        source: 'Engine',
      });
      return;
    }
    downloadTextFile(svg, `${model.getDecisionModelId()}.svg`, 'image/svg+xml');
  });

  bifrost.commands.register(DECISION_VIEWER_COMMANDS.exportPng, async (editorDocument: EditorDocument) => {
    const model = await bifrost.editors.getEditorDocumentModel<DecisionViewerDocumentModel>(editorDocument);
    const blob = await model.exportPng(2);
    if (blob.size === 0) {
      bifrost.notifications.open({
        type: 'warning',
        content: 'Could not export PNG — canvas not ready.',
        source: 'Engine',
      });
      return;
    }
    downloadBlob(blob, `${model.getDecisionModelId()}.png`);
  });

  bifrost.commands.register(
    'std.editor.zoomToActualSize.engine-decision-viewer',
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DecisionViewerDocumentModel>(editorDocument);
      model.zoomToActualSize();
    },
  );

  bifrost.commands.register(
    'std.editor.zoomToViewport.engine-decision-viewer',
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DecisionViewerDocumentModel>(editorDocument);
      model.zoomToViewport();
    },
  );

  bifrost.commands.register('std.editor.showExportDialog.engine-decision-viewer', async () => {
    const editorDocument = bifrost.editors.getFocusedEditorDocument();
    if (!editorDocument) {
      return;
    }

    const dialogOptions: DialogOptions = {
      title: 'Export Decision as ...',
      content: [
        {
          type: 'response_link',
          label: 'SVG',
          sublabel: 'Higher quality',
          icon: 'ph-light ph-selection',
          response: 'svg',
        },
        {
          type: 'response_link',
          label: 'PNG',
          sublabel: 'Easier to share',
          icon: 'ph-duotone ph-palette',
          response: 'png',
        },
      ],
      actions: [],
    };

    const dialogResult = await bifrost.dialog.open(dialogOptions);
    if (dialogResult.wasCancelled || !dialogResult.response) {
      return;
    }

    if (dialogResult.response === 'svg') {
      await bifrost.commands.executeCommand(DECISION_VIEWER_COMMANDS.exportSvg, [editorDocument]);
    } else if (dialogResult.response === 'png') {
      await bifrost.commands.executeCommand(DECISION_VIEWER_COMMANDS.exportPng, [editorDocument]);
    }
  });
}
