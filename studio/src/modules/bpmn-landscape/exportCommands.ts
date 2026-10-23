import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import {
  getImageFormatForFilename,
  IMAGE_SAVE_DIALOG_FILTERS,
  renderSvgToRasterImage,
  runWithExportHint,
  SUPPORTED_IMAGE_EXTENSIONS_TEXT,
} from '#modules/bpmn-core/ImageExportFunctions';

import LandscapeMapDocumentModel from './LandscapeMapDocumentModel';

const DOCUMENT_TYPE = 'bpmn-landscape-map';
const RASTER_FORMATS = ['png', 'jpeg', 'webp'] as const;

function showExportNotification(bifrost: Bifrost, type: 'warning' | 'error', content: string): void {
  bifrost.notifications.open({ type, content, source: 'Landscapes' });
}

function getFocusedMapDocument(bifrost: Bifrost): EditorDocument | null {
  const editorDocument = bifrost.editors.getFocusedEditorDocument();
  return editorDocument?.documentType === DOCUMENT_TYPE ? editorDocument : null;
}

/** Image export of a map: the Export toolbar button and `std.editor.exportDocumentAs` end up here. */
export function registerLandscapeExportCommands(bifrost: Bifrost): void {
  bifrost.commands.register(
    `std.editor.showExportDialog.${DOCUMENT_TYPE}`,
    async () => {
      const editorDocument = getFocusedMapDocument(bifrost);
      if (editorDocument == null) {
        return;
      }
      const defaultPath = bifrost.files.isLocalFilename(editorDocument.uri)
        ? bifrost.files.getLocalFilenameForUri(editorDocument.uri).replace(/\.bfwmap$/i, '.png')
        : `${editorDocument.label}.png`;
      const filename = await bifrost.dialog.showSaveFile({
        title: 'Export as image',
        defaultPath,
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
      await bifrost.commands.executeCommand('std.editor.exportDocumentAs', [editorDocument, format, filename]);
    },
    {
      enabledWhen: () => {
        const editorDocument = getFocusedMapDocument(bifrost);
        const model = editorDocument == null ? null : bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
        return model instanceof LandscapeMapDocumentModel && model.getMapProperties() != null;
      },
    },
  );

  bifrost.commands.register(
    `std.editor.exportDocumentAs.${DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument, format: string, filename: string) => {
      const model = await bifrost.editors.getEditorDocumentModel<LandscapeMapDocumentModel>(editorDocument);
      const svg = model.exportSvg();
      if (svg == null) {
        showExportNotification(bifrost, 'warning', 'This map cannot be read, so it cannot be exported.');
        return;
      }
      const rasterFormat = RASTER_FORMATS.find((candidate) => candidate === format);
      if (format !== 'svg' && rasterFormat == null) {
        showExportNotification(bifrost, 'error', `The image format '${format}' is not supported.`);
        return;
      }
      const content =
        rasterFormat == null
          ? svg
          : await runWithExportHint(bifrost.dialog, async () => renderSvgToRasterImage(svg, rasterFormat));
      try {
        await bifrost.files.save(bifrost.files.getUriForFilename(filename), content);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        showExportNotification(bifrost, 'error', `The map could not be written to '${filename}': ${reason}`);
      }
    },
  );
}
