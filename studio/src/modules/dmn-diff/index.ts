import type { Bifrost } from '#bifrost/Bifrost';

import type { EditorDocument } from '@evil/bifrost_fw_sdk';
import { assertNotNull, getUrlForOpenInNewTab } from '@evil/bifrost_fw_sdk';

import { DmnDiff, buildDmnChangeSummary, formatDmnChangeSummaryAsMarkdown } from '../dmn-core/diff';
import DmnDiffDocumentModel from './DmnDiffDocumentModel';
import DmnDiffDocumentRenderer from './DmnDiffDocumentRenderer';
import DmnHistoryPreviewDocumentModel from './history/DmnHistoryPreviewDocumentModel';
import DmnHistoryPreviewDocumentRenderer from './history/DmnHistoryPreviewDocumentRenderer';

const DMN_DOCUMENT_TYPE = 'dmn';
const DMN_DIFF_DOCUMENT_TYPE = 'dmn.diff';
const HISTORY_PREVIEW_DOCUMENT_TYPE = 'dmn.history-preview';

export const DMN_DIFF_HELP_TEXT_ID = 'dmn-diff/home';

export function onLoad(bifrost: Bifrost): void {
  bifrost.editors.registerDocumentType(DMN_DIFF_DOCUMENT_TYPE, {
    uriMatch: /^fragment\+dmn\.diff:/,
    modelKey: 'DmnDiffDocumentModel',
    modelConstructor: DmnDiffDocumentModel,
    rendererKey: 'DmnDiffDocumentRenderer',
    rendererConstructor: DmnDiffDocumentRenderer,
    icon: 'dmn-diff/editor-tab/default',
  });

  bifrost.icons.registerIcons({
    'dmn-diff/editor-tab/default': 'ph-light ph-columns dmn-diff__tab-icon',
    'dmn-diff/element/moved': 'ph ph-arrows-out',
    'dmn-diff/element/deleted': 'ph-duotone ph-minus-circle',
    'dmn-diff/element/added': 'ph-duotone ph-plus-circle',
    'dmn-diff/element/updated': 'ph-duotone ph-pencil',
  });

  // --- History Preview document type ---

  bifrost.editors.registerDocumentType(HISTORY_PREVIEW_DOCUMENT_TYPE, {
    uriMatch: /^fragment\+dmn\.history-preview:/,
    modelKey: 'DmnHistoryPreviewDocumentModel',
    modelConstructor: DmnHistoryPreviewDocumentModel,
    rendererKey: 'DmnHistoryPreviewDocumentRenderer',
    rendererConstructor: DmnHistoryPreviewDocumentRenderer,
    icon: 'dmn-diff/history-preview',
  });

  bifrost.icons.registerIcons({
    'dmn-diff/history-preview': 'ph-duotone ph-clock-counter-clockwise dmn-diff__history-preview--hero-icon',
  });

  // --- History Preview commands ---

  bifrost.commands.register(
    'dmn.diff.openHistoryPreview',
    (uri: string, commitHash: string, message: string, author: string, date: string) => {
      const fragmentUri = getUrlForOpenInNewTab(HISTORY_PREVIEW_DOCUMENT_TYPE, uri, commitHash, {
        commitHash,
        message,
        author,
        date,
      });
      const shortHash = commitHash.substring(0, 7);
      const filename = bifrost.files.getLocalBasename(uri);
      bifrost.editors.focusOrOpenEditorDocument(fragmentUri, `${filename} @ ${shortHash}`);
    },
  );

  bifrost.commands.register(
    'dmn.diff.historyPreview.changeViewMode',
    (model: DmnHistoryPreviewDocumentModel, newMode: 'preview' | 'diff') => model.setViewerMode(newMode),
    { enabledWhen: (model: DmnHistoryPreviewDocumentModel) => model != null && model.isReadyForInteraction() },
  );

  bifrost.commands.register(
    'dmn.diff.history.restoreFile',
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnHistoryPreviewDocumentModel>(editorDocument);
      const filename = model.getFilename();
      const shortHash = model.getShortHash();
      const historicalXml = model.getHistoricalXml();

      if (!historicalXml) {
        bifrost.notifications.open({
          type: 'error',
          content: 'Historical data is not available.',
          source: 'DMN Diff',
        });
        return;
      }

      await bifrost.commands.executeCommand('git.restoreFileContent', [
        editorDocument,
        model.getParentUri(),
        historicalXml,
        filename,
        shortHash,
      ]);
    },
    { enabledWhen: (editorDocument: EditorDocument) => editorDocument.documentType === HISTORY_PREVIEW_DOCUMENT_TYPE },
  );

  // --- Zoom commands for history-preview ---

  bifrost.commands.register(
    `std.editor.zoomToActualSize.${HISTORY_PREVIEW_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnHistoryPreviewDocumentModel>(editorDocument);
      if (model.isReadyForInteraction()) {
        model.setZoom(1);
      }
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToViewport.${HISTORY_PREVIEW_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnHistoryPreviewDocumentModel>(editorDocument);
      if (model.isReadyForInteraction()) {
        model.zoomToViewport();
      }
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToSelectedElement.${HISTORY_PREVIEW_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnHistoryPreviewDocumentModel>(editorDocument);
      if (!model.isReadyForInteraction()) {
        return;
      }
      const elements = model.getSelectedElements();
      if (elements != null && elements.length > 0) {
        model.zoomToElements(elements.map((element) => element.id));
      }
    },
  );

  // --- Zoom commands for diff ---

  bifrost.commands.register(
    `std.editor.zoomToActualSize.${DMN_DIFF_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnDiffDocumentModel>(editorDocument);
      if (model.isReadyForInteraction()) {
        model.setZoom(1);
      }
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToViewport.${DMN_DIFF_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnDiffDocumentModel>(editorDocument);
      if (model.isReadyForInteraction()) {
        model.zoomToViewport();
      }
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToSelectedElement.${DMN_DIFF_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnDiffDocumentModel>(editorDocument);
      if (!model.isReadyForInteraction()) {
        return;
      }
      const elements = model.getSelectedElements();
      if (elements != null && elements.length > 0) {
        model.zoomToElements(elements.map((element) => element.id));
      }
    },
  );

  // --- Diff commands ---

  bifrost.commands.register(
    'dmn.diff.openDiffOriginalDataVsCurrentData',
    (editorDocument: EditorDocument) => {
      const focusedEditorDocument = editorDocument ?? bifrost.editors.getFocusedEditorDocument();
      assertNotNull(focusedEditorDocument, 'focusedEditorDocument');
      const uri = buildDiffUri(focusedEditorDocument.uri);
      bifrost.editors.focusOrOpenEditorDocument(uri, `Diff: ${focusedEditorDocument.label} (Working copy)`);
    },
    {
      visibleInSearch: true,
      description: 'Diff: Show diff for working copy changes (DMN)',
      enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.documentType === DMN_DOCUMENT_TYPE,
    },
  );

  bifrost.commands.register(
    'dmn.diff.openDiffCurrentDataVsOriginalData',
    (editorDocument: EditorDocument) => {
      const uri = buildDiffUri(editorDocument.uri, editorDocument.uri, 'current', 'original');
      bifrost.editors.focusOrOpenEditorDocument(uri, `Diff: ${editorDocument.label} (Working copy)`);
    },
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.documentType === DMN_DOCUMENT_TYPE },
  );

  bifrost.commands.register('dmn.diff.openDiffTwoFiles', (beforeUri: string, afterUri: string) => {
    const uri = buildDiffUri(beforeUri, afterUri, 'original', 'original');
    const beforeFilename = bifrost.files.getLocalBasename(beforeUri);
    const afterFilename = bifrost.files.getLocalBasename(afterUri);
    bifrost.editors.focusOrOpenEditorDocument(uri, `Diff: ${beforeFilename} vs ${afterFilename}`);
  });

  // --- Change summary ---

  bifrost.commands.register(
    'dmn.diff.getChangeSummaryMarkdown',
    async (beforeXml: string, afterXml: string, fileName: string): Promise<string> => {
      const dmnDiff = new DmnDiff(beforeXml, afterXml);
      const changes = await dmnDiff.diff();
      const summary = buildDmnChangeSummary(changes);
      return formatDmnChangeSummaryAsMarkdown(summary, fileName);
    },
  );

  bifrost.commands.register(
    'dmn.diff.showChangeSummaryDialog',
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<DmnDiffDocumentModel>(editorDocument);
      const summary = model.getChangeSummary();

      if (summary == null) {
        bifrost.notifications.open('Diff data is not yet available.');
        return;
      }

      const fileName = model.getAfterFilename() || 'unknown';
      const summaryText = formatDmnChangeSummaryAsMarkdown(summary, fileName, { includeHeading: false });

      const result = await bifrost.dialog.open({
        title: `Change Summary for ${fileName}`,
        content: [{ type: 'markdown_container', id: 'changeSummary', text: summaryText, size: 'medium' }],
        actions: [
          { label: 'Copy to Clipboard', response: 'copy' },
          { label: 'Close', response: 'close', default: true, cancel: true },
        ],
      });

      if (result?.response === 'copy') {
        try {
          await navigator.clipboard.writeText(summaryText);
          bifrost.notifications.open('Change summary copied to clipboard.');
        } catch {
          bifrost.notifications.open({
            type: 'error',
            content: 'Failed to copy to clipboard.',
            source: 'DMN Diff',
          });
        }
      }
    },
    { enabledWhen: (editorDocument: EditorDocument) => editorDocument.documentType === DMN_DIFF_DOCUMENT_TYPE },
  );

  // --- Panes ---

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'dmn-diff/panes/properties/ChangeOverview',
      'dmn-diff/pane-providers/properties/ChangeOverview',
      require('./panes/DmnChangeOverview'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'dmn-diff/panes/properties/ContentDiff',
      'dmn-diff/pane-providers/properties/ContentDiff',
      require('./panes/DmnContentDiff'),
    ),
  ]);

  // --- Help text ---

  bifrost.helpTexts.registerHelpText(DMN_DIFF_HELP_TEXT_ID, require('./texts/dmn-diff.md'));
}

type DiffDataType = 'original' | 'current';

function buildDiffUri(
  beforeUri: string,
  afterUri: string | null = null,
  beforeData: DiffDataType = 'original',
  afterData: DiffDataType = 'current',
): string {
  return getUrlForOpenInNewTab('dmn.diff', beforeUri, 'side-by-side', {
    beforeUri: beforeUri,
    beforeData: beforeData,
    afterUri: afterUri || beforeUri,
    afterData: afterData,
  });
}
