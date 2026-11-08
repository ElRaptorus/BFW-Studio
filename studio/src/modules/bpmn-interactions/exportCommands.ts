import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import {
  getImageFormatForFilename,
  IMAGE_SAVE_DIALOG_FILTERS,
  renderSvgToRasterImage,
  runWithExportHint,
  SUPPORTED_IMAGE_EXTENSIONS_TEXT,
} from '#modules/bpmn-core/ImageExportFunctions';

import InteractionsDocumentModel from './InteractionsDocumentModel';

const INTERACTIONS_DOCUMENT_TYPE = 'bpmn-interactions-map';

const RASTER_FORMATS = ['png', 'jpeg', 'webp'] as const;

function showExportNotification(bifrost: Bifrost, type: 'warning' | 'error', content: string): void {
  bifrost.notifications.open({ type, content, source: 'Interactions' });
}

/** Default save path for an interactions image export (`<solution name>-interactions.png` or first project folder). */
function defaultInteractionsExportPath(bifrost: Bifrost): string {
  const solution = bifrost.solution.getSolution();
  const solutionFileUri = solution?.solutionFileUri;
  if (solutionFileUri != null) {
    const directory = bifrost.files.getLocalFilenameForUri(solutionFileUri).replace(/[/\\][^/\\]+$/, '');
    const basename = bifrost.files.getLocalBasename(solutionFileUri, true);
    return bifrost.files.joinPaths(directory, `${basename}-interactions.png`);
  }
  const firstProject = solution?.projects[0];
  if (firstProject != null) {
    return bifrost.files.joinPaths(
      bifrost.files.getLocalFilenameForUri(firstProject.baseUri),
      `${firstProject.name}-interactions.png`,
    );
  }
  return 'interactions.png';
}

function getFocusedInteractionsDocument(bifrost: Bifrost): EditorDocument | null {
  const editorDocument = bifrost.editors.getFocusedEditorDocument();
  return editorDocument?.documentType === INTERACTIONS_DOCUMENT_TYPE ? editorDocument : null;
}

export function registerInteractionsExportCommands(bifrost: Bifrost): void {
  bifrost.commands.register(
    `std.editor.showExportDialog.${INTERACTIONS_DOCUMENT_TYPE}`,
    async () => {
      const filename = await bifrost.dialog.showSaveFile({
        title: 'Export as image',
        defaultPath: defaultInteractionsExportPath(bifrost),
        filters: IMAGE_SAVE_DIALOG_FILTERS,
      });
      if (filename == null || filename.trim() === '') {
        return;
      }
      const format = getImageFormatForFilename(filename);
      if (format == null) {
        showExportNotification(
          bifrost,
          'error',
          `Cannot export to '${filename}'. Choose a file name ending in ${SUPPORTED_IMAGE_EXTENSIONS_TEXT}.`,
        );
        return;
      }
      const editorDocument = getFocusedInteractionsDocument(bifrost);
      if (editorDocument == null) {
        return;
      }
      await bifrost.commands.executeCommand('std.editor.exportDocumentAs', [editorDocument, format, filename]);
    },
    {
      enabledWhen: () => {
        const editorDocument = getFocusedInteractionsDocument(bifrost);
        const model = editorDocument == null ? null : bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
        return model instanceof InteractionsDocumentModel && model.hasGeneratedDiagram();
      },
    },
  );

  bifrost.commands.register(
    `std.editor.exportDocumentAs.${INTERACTIONS_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument, format: string, filename: string) => {
      const model = await bifrost.editors.getEditorDocumentModel<InteractionsDocumentModel>(editorDocument);
      const svg = model.exportSvg();
      if (svg == null) {
        showExportNotification(bifrost, 'warning', 'There is no generated diagram to export.');
        return;
      }
      const rasterFormat = RASTER_FORMATS.find((candidate) => candidate === format);
      if (format !== 'svg' && rasterFormat == null) {
        showExportNotification(bifrost, 'error', `The image format '${format}' is not supported.`);
        return;
      }
      try {
        const content =
          rasterFormat == null
            ? svg
            : await runWithExportHint(bifrost.dialog, async () => renderSvgToRasterImage(svg, rasterFormat));
        await bifrost.files.save(bifrost.files.getUriForFilename(filename), content);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        showExportNotification(bifrost, 'error', `The diagram could not be exported to '${filename}': ${reason}`);
      }
    },
  );
}
