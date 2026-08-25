import type { Bifrost } from '#bifrost/Bifrost';

import type { EditorDocument } from '@evil/bifrost_fw_sdk';
import { assertNotNull, getUrlForOpenInNewTab, parseOpenInNewTabUrl } from '@evil/bifrost_fw_sdk';

import { extractProcessName, slugify } from '../bpmn-core/bpmnProcessUtils';
import {
  type RawDiffResult,
  buildAugmentedChangeSummary,
  buildChangeSummary,
  createBpmnModdleForDiff,
  formatChangeSummaryAsMarkdown,
} from '../bpmn-core/diff';
import BpmnDiffDocumentModel from './BpmnDiffDocumentModel';
import BpmnDiffDocumentRenderer from './BpmnDiffDocumentRenderer';
import BpmnHistoryPreviewDocumentModel from './history/BpmnHistoryPreviewDocumentModel';
import BpmnHistoryPreviewDocumentRenderer from './history/BpmnHistoryPreviewDocumentRenderer';

const BPMN_DOCUMENT_TYPE = 'bpmn';
const BPMN_DIFF_DOCUMENT_TYPE = 'bpmn.diff';
const HISTORY_PREVIEW_DOCUMENT_TYPE = 'bpmn.history-preview';

export const BPMN_DIFF_HELP_TEXT_ID = 'bpmn-diff/home';

export function onLoad(bifrost: Bifrost): void {
  bifrost.editors.registerDocumentType(BPMN_DIFF_DOCUMENT_TYPE, {
    uriMatch: /^fragment\+bpmn.diff:/,
    modelKey: 'BpmnDiffDocumentModel',
    modelConstructor: BpmnDiffDocumentModel,
    rendererKey: 'BpmnDiffDocumentRenderer',
    rendererConstructor: BpmnDiffDocumentRenderer,
    icon: 'bpmn-diff/editor-tab/default',
  });

  bifrost.icons.registerIcons({
    'bpmn-diff/editor-tab/default': 'ph-light ph-columns bpmn__diff-view--tab-icon',
    'bpmn-diff/element/moved': 'ph ph-arrows-out',
    'bpmn-diff/element/deleted': 'ph-duotone ph-minus-circle',
    'bpmn-diff/element/added': 'ph-duotone ph-plus-circle',
    'bpmn-diff/element/updated': 'ph-duotone ph-pencil',
  });

  // --- History Preview document type ---

  bifrost.editors.registerDocumentType(HISTORY_PREVIEW_DOCUMENT_TYPE, {
    uriMatch: /^fragment\+bpmn\.history-preview:/,
    modelKey: 'BpmnHistoryPreviewDocumentModel',
    modelConstructor: BpmnHistoryPreviewDocumentModel,
    rendererKey: 'BpmnHistoryPreviewDocumentRenderer',
    rendererConstructor: BpmnHistoryPreviewDocumentRenderer,
    icon: 'bpmn-diff/history-preview',
  });

  bifrost.icons.registerIcons({
    'bpmn-diff/history-preview': 'ph-duotone ph-clock-counter-clockwise bpmn-diff__history-preview--hero-icon',
  });

  bifrost.commands.register(
    'bpmn.diff.openHistoryPreview',
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
    'bpmn.diff.historyPreview.changeViewMode',
    (model: BpmnHistoryPreviewDocumentModel, newMode: 'preview' | 'diff') => model.setViewerMode(newMode),
    { enabledWhen: (model: BpmnHistoryPreviewDocumentModel) => model != null && model.isReadyForInteraction() },
  );

  bifrost.commands.register(
    'bpmn.diff.history.restoreFile',
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<BpmnHistoryPreviewDocumentModel>(editorDocument);
      const filename = model.getFilename();
      const shortHash = model.getShortHash();
      const historicalXml = model.getHistoricalXml();

      if (!historicalXml) {
        bifrost.notifications.open({
          type: 'error',
          content: 'Historical data is not available.',
          source: 'BPMN Diff',
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

  bifrost.commands.register(
    `std.editor.zoomToActualSize.${HISTORY_PREVIEW_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<BpmnHistoryPreviewDocumentModel>(editorDocument);

      if (model.isReadyForInteraction()) {
        model.setZoom(1);
      }
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToViewport.${HISTORY_PREVIEW_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<BpmnHistoryPreviewDocumentModel>(editorDocument);

      if (model.isReadyForInteraction()) {
        model.zoomToViewport();
      }
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToSelectedElement.${HISTORY_PREVIEW_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<BpmnHistoryPreviewDocumentModel>(editorDocument);

      if (!model.isReadyForInteraction()) {
        return;
      }

      const elements = model.getSelectedElements();

      if (elements != null && elements.length > 0) {
        model.zoomToElements(elements.map((element) => element.id));
      }
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToActualSize.${BPMN_DIFF_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<BpmnDiffDocumentModel>(editorDocument);

      if (model.isReadyForInteraction()) {
        model.setZoom(1);
      }
    },
  );

  bifrost.commands.register(
    `std.editor.zoomToViewport.${BPMN_DIFF_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<BpmnDiffDocumentModel>(editorDocument);

      if (model.isReadyForInteraction()) {
        model.zoomToViewport();
      }
    },
  );
  bifrost.commands.register(
    `std.editor.zoomToSelectedElement.${BPMN_DIFF_DOCUMENT_TYPE}`,
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<BpmnDiffDocumentModel>(editorDocument);

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
    'bpmn.diff.openDiffOriginalDataVsCurrentData',
    (editorDocument: EditorDocument) => {
      const focusedEditorDocument = editorDocument ?? bifrost.editors.getFocusedEditorDocument();

      assertNotNull(focusedEditorDocument, 'focusedEditorDocument');
      const uri = buildDiffUri(focusedEditorDocument.uri);
      bifrost.editors.focusOrOpenEditorDocument(uri, `Diff: ${focusedEditorDocument.label} (Working copy)`);
    },
    {
      visibleInSearch: true,
      description: 'Diff: Show diff for working copy changes',
      enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.documentType === BPMN_DOCUMENT_TYPE,
    },
  );

  bifrost.commands.register(
    'bpmn.diff.openDiffCurrentDataVsOriginalData',
    (editorDocument: EditorDocument) => {
      const uri = buildDiffUri(editorDocument.uri, editorDocument.uri, 'current', 'original');
      bifrost.editors.focusOrOpenEditorDocument(uri, `Diff: ${editorDocument.label} (Working copy)`);
    },
    { enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.documentType === BPMN_DOCUMENT_TYPE },
  );

  bifrost.commands.register('bpmn.diff.openDiffTwoFiles', (beforeUri: string, afterUri: string) => {
    const uri = buildDiffUri(beforeUri, afterUri, 'original', 'original');

    const beforeFilename = bifrost.files.getLocalBasename(beforeUri);
    const afterFilename = bifrost.files.getLocalBasename(afterUri);

    bifrost.editors.focusOrOpenEditorDocument(uri, `Diff: ${beforeFilename} vs ${afterFilename}`);
  });

  bifrost.commands.register(
    'bpmn.diff.exportBeforeToNewFile',
    (editorDocument: EditorDocument) => {
      bifrost.commands.executeCommand('bpmn.diff.showExportBeforeDialog', [editorDocument]);
    },
    { enabledWhen: (editorDocument: EditorDocument) => editorDocument.documentType === BPMN_DIFF_DOCUMENT_TYPE },
  );

  bifrost.commands.register(
    'bpmn.diff.undoSelectedChange',
    (editorDocument: EditorDocument) => {
      bifrost.notifications.open('TODO: Implement me!');
    },
    {
      enabledWhen: (editorDocument: EditorDocument) =>
        bifrost.editors.getFocusedEditorDocument()?.documentType === BPMN_DIFF_DOCUMENT_TYPE &&
        editorDocument.metadata.selectedElementIds?.length > 0,
    },
  );

  bifrost.commands.register('bpmn.diff.showExportBeforeDialog', async (editorDocument: EditorDocument) => {
    assertNotNull(editorDocument, 'editorDocument');

    const getDefaultPath = (uri: string, imageFileExtension: string): string => {
      const isLocalFilename = bifrost.files.isLocalFilename(uri);
      if (isLocalFilename) {
        const bpmnFilename = isLocalFilename ? bifrost.files.getLocalFilenameForUri(uri) : '';
        const bpmnFileExtension = isLocalFilename ? bifrost.files.getFileExtension(uri) : '';
        const regex = new RegExp(`${bpmnFileExtension}$`, 'gi');
        const defaultPath =
          bpmnFileExtension === ''
            ? `${bpmnFilename}${imageFileExtension}`
            : bpmnFilename.replace(regex, imageFileExtension);

        return defaultPath;
      }

      return `${editorDocument.label}${imageFileExtension}`;
    };

    const { data } = parseOpenInNewTabUrl(editorDocument.uri);
    const beforeUri = data.beforeUri;
    const format = 'bpmn';
    const extension = { name: 'BPMN', extensions: ['bpmn'] };

    const targetFilename = await bifrost.dialog.showSaveFile({
      defaultPath: getDefaultPath(beforeUri, `.${format}`),
      filters: [extension],
    });
    if (targetFilename == null || targetFilename.trim() === '') {
      return;
    }

    bifrost.commands.executeCommand('bpmn.diff.editor.exportDocumentAs', [editorDocument, format, targetFilename]);
  });

  bifrost.commands.register(
    'bpmn.diff.editor.exportDocumentAs',
    async (editorDocument: EditorDocument, format: string, filename: string) => {
      const { data } = parseOpenInNewTabUrl(editorDocument.uri);
      const beforeUri = data.beforeUri;
      const beforeData = data.beforeData;
      let beforeXml: string;
      if (beforeData === 'original') {
        beforeXml = await bifrost.files.load(beforeUri);
      } else {
        throw new Error('Unsupported value: `beforeData` has to be one of the following: "original"');
      }

      const fileContent = await bifrost.commands.executeCommand('bpmn.diagram.resetRelevantIds', [beforeXml]);
      const targetUri = bifrost.files.getUriForFilename(filename);

      bifrost.files.save(targetUri, fileContent);
    },
  );

  // TODO: for `zoomToSelectedElement` to work in diff-view, we have to keep track on which side the element was
  //        focused to zoom the viewer, since zooming both viewers to the selected element (instead of the same
  //        position in the diagram) makes no sense
  // bifrost.commands.register('std.editor.zoomToSelectedElement.bpmn.diff', async (editorDocument: EditorDocument) => {
  // });

  bifrost.commands.register(
    'bpmn.diff.getChangeSummaryMarkdown',
    async (beforeXml: string, afterXml: string, fileName: string): Promise<string> => {
      const { diff } = await import('bpmn-js-differ');

      const moddle = createBpmnModdleForDiff();
      const { rootElement: defsBefore } = await moddle.fromXML(beforeXml);
      const { rootElement: defsAfter } = await moddle.fromXML(afterXml);

      const rawHandler = diff(defsBefore, defsAfter);
      const rawDiff = JSON.parse(JSON.stringify(rawHandler)) as RawDiffResult;

      let summary;
      try {
        summary = await buildAugmentedChangeSummary(rawDiff, beforeXml, afterXml);
      } catch {
        summary = buildChangeSummary(rawDiff);
      }

      return formatChangeSummaryAsMarkdown(summary, fileName);
    },
  );

  bifrost.commands.register(
    'bpmn.diff.showChangeSummaryDialog',
    async (editorDocument: EditorDocument) => {
      const bpmnDiffDocumentModel = await bifrost.editors.getEditorDocumentModel<BpmnDiffDocumentModel>(editorDocument);
      const summary = bpmnDiffDocumentModel.getChangeSummary();

      if (summary == null) {
        bifrost.notifications.open('Diff data is not yet available.');
        return;
      }

      const fileName = bpmnDiffDocumentModel.getAfterFilename() || 'unknown';
      const summaryText = formatChangeSummaryAsMarkdown(summary, fileName, { includeHeading: false });

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
            source: 'BPMN Diff',
          });
        }
      }
    },
    { enabledWhen: (editorDocument: EditorDocument) => editorDocument.documentType === BPMN_DIFF_DOCUMENT_TYPE },
  );

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn-diff/panes/properties/ChangeOverview',
      'bpmn-diff/pane-providers/properties/ChangeOverview',
      require('./panes/ChangeOverview'),
    ),
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn-diff/panes/properties/ContentDiff',
      'bpmn-diff/pane-providers/properties/ContentDiff',
      require('./panes/ContentDiff'),
    ),
  ]);

  bifrost.commands.register(
    'bpmn.diff.suggestBranchNameForProcess',
    async (): Promise<{ uri: string; suggestedName: string } | null> => {
      const editorDocument = bifrost.editors.getFocusedEditorDocument();
      if (!editorDocument || editorDocument.documentType !== BPMN_DOCUMENT_TYPE) {
        return null;
      }

      const uri = editorDocument.uri;
      let processName: string | null = null;

      try {
        const xml = await bifrost.files.load(uri);
        processName = extractProcessName(xml);
      } catch {
        // fall through — will use filename
      }

      if (!processName) {
        const filename = bifrost.files.getFilename(uri);
        processName = filename.replace(/\.bpmn$/i, '');
      }

      const slug = slugify(processName);
      return { uri, suggestedName: `feature/${slug}` };
    },
  );

  bifrost.helpTexts.registerHelpText(BPMN_DIFF_HELP_TEXT_ID, require('./texts/bpmn-diff.md'));
}

type DiffDataType = 'original' | 'current';

function buildDiffUri(
  beforeUri: string,
  afterUri: string | null = null,
  beforeData: DiffDataType = 'original',
  afterData: DiffDataType = 'current',
): string {
  const uri = getUrlForOpenInNewTab('bpmn.diff', beforeUri, 'side-by-side', {
    beforeUri: beforeUri,
    beforeData: beforeData,
    afterUri: afterUri || beforeUri,
    afterData: afterData,
  });

  return uri;
}
