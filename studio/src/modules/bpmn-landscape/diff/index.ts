import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import { getUrlForOpenInNewTab, parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { ModelChangeDigest } from '#bifrost/contracts/SourceControlTypes';
import { buildModelChangeDigestForXmlPair } from '#modules/bpmn-core/diff/modelChangeDigest';

import LandscapeHistoryPreviewDocumentModel from '../history/LandscapeHistoryPreviewDocumentModel';
import LandscapeHistoryPreviewDocumentRenderer from '../history/LandscapeHistoryPreviewDocumentRenderer';
import { LANDSCAPE_DOCUMENT_TYPE } from '../landscapeFolder';
import * as LandscapeChangeOverview from '../panes/LandscapeChangeOverview';
import LandscapeDiffDocumentModel from './LandscapeDiffDocumentModel';
import LandscapeDiffDocumentRenderer from './LandscapeDiffDocumentRenderer';
import { diffLandscapeMapTexts, formatLandscapeDiffAsMarkdown } from './landscapeMapDiff';

const DIFF_DOCUMENT_TYPE = 'bpmn-landscape-map.diff';
const HISTORY_PREVIEW_DOCUMENT_TYPE = 'bpmn-landscape-map.history-preview';

// `label` is the tab title. `beforeLabel` / `afterLabel` replace the file links in the sublabel, so users never open a
// temporary copy as an editable map. `sourceFileUri` adds an "Open File" button for the real file.
type DiffOpenOptions = { label?: string; sourceFileUri?: string; beforeLabel?: string; afterLabel?: string };

function buildDiffUri(
  beforeUri: string,
  afterUri: string,
  afterData: 'original' | 'current',
  options: DiffOpenOptions = {},
  beforeData: 'original' | 'current' = 'original',
): string {
  return getUrlForOpenInNewTab(DIFF_DOCUMENT_TYPE, beforeUri, 'side-by-side', {
    beforeUri,
    beforeData,
    afterUri,
    afterData,
    ...(options.sourceFileUri != null ? { sourceFileUri: options.sourceFileUri } : {}),
    ...(options.beforeLabel != null ? { beforeLabel: options.beforeLabel } : {}),
    ...(options.afterLabel != null ? { afterLabel: options.afterLabel } : {}),
  });
}

function registerZoomCommands(bifrost: Bifrost, documentType: string): void {
  const withReadyModel =
    (action: (model: LandscapeDiffDocumentModel) => void) =>
    async (editorDocument: EditorDocument): Promise<void> => {
      const model = await bifrost.editors.getEditorDocumentModel<LandscapeDiffDocumentModel>(editorDocument);
      if (model.isReadyForInteraction()) {
        action(model);
      }
    };
  bifrost.commands.register(
    `std.editor.zoomToActualSize.${documentType}`,
    withReadyModel((model) => model.setZoom(1)),
  );
  bifrost.commands.register(
    `std.editor.zoomToViewport.${documentType}`,
    withReadyModel((model) => model.zoomToViewport()),
  );
  bifrost.commands.register(
    `std.editor.zoomToSelectedElement.${documentType}`,
    withReadyModel((model) => {
      const elements = model.getSelectedElements();
      if (elements.length > 0) {
        void model.zoomToElements(elements.map((element) => element.id));
      }
    }),
  );
}

export function registerLandscapeDiff(bifrost: Bifrost): void {
  bifrost.commands.register(
    'bpmn.landscape.diff.getChangeSummaryMarkdown',
    async (beforeText: string, afterText: string, fileName: string): Promise<string> =>
      formatLandscapeDiffAsMarkdown(await diffLandscapeMapTexts(beforeText, afterText), fileName),
  );

  // Either side may be null for a file that was added or deleted. Rejects when a side is not a readable map.
  bifrost.commands.register(
    'bpmn.landscape.diff.getChangeDigest',
    (beforeText: string | null, afterText: string | null): Promise<ModelChangeDigest> =>
      buildModelChangeDigestForXmlPair(beforeText, afterText, 'map', async (before, after) => {
        const diff = await diffLandscapeMapTexts(before, after);
        return { ...diff, definitionsMetadata: diff.mapProperties };
      }),
  );

  bifrost.icons.registerIcons({
    'bpmn-landscape/diff/editor-tab': 'ph-light ph-columns landscape-diff__tab-icon',
    'bpmn-landscape/diff/history-preview': 'ph-duotone ph-clock-counter-clockwise landscape-diff__history-icon',
    'bpmn-landscape/diff/element/added': 'ph-duotone ph-plus-circle',
    'bpmn-landscape/diff/element/deleted': 'ph-duotone ph-minus-circle',
    'bpmn-landscape/diff/element/updated': 'ph-duotone ph-pencil',
    'bpmn-landscape/diff/element/moved': 'ph ph-arrows-out',
  });

  bifrost.editors.registerDocumentType(DIFF_DOCUMENT_TYPE, {
    page: 'design/source',
    uriMatch: /^fragment\+bpmn-landscape-map\.diff:/,
    modelKey: 'LandscapeDiffDocumentModel',
    modelConstructor: LandscapeDiffDocumentModel,
    rendererKey: 'LandscapeDiffDocumentRenderer',
    rendererConstructor: LandscapeDiffDocumentRenderer,
    icon: 'bpmn-landscape/diff/editor-tab',
  });

  bifrost.editors.registerDocumentType(HISTORY_PREVIEW_DOCUMENT_TYPE, {
    page: 'design/source',
    uriMatch: /^fragment\+bpmn-landscape-map\.history-preview:/,
    modelKey: 'LandscapeHistoryPreviewDocumentModel',
    modelConstructor: LandscapeHistoryPreviewDocumentModel,
    rendererKey: 'LandscapeHistoryPreviewDocumentRenderer',
    rendererConstructor: LandscapeHistoryPreviewDocumentRenderer,
    icon: 'bpmn-landscape/diff/history-preview',
  });

  bifrost.commands.register(
    'bpmn.landscape.diff.openDiffTwoFiles',
    (beforeUri: string, afterUri: string, options: DiffOpenOptions = {}) => {
      const beforeFilename = bifrost.files.getLocalBasename(beforeUri);
      const afterFilename = bifrost.files.getLocalBasename(afterUri);
      bifrost.editors.focusOrOpenEditorDocument(
        buildDiffUri(beforeUri, afterUri, 'original', options),
        options.label ?? `Diff: ${beforeFilename} vs ${afterFilename}`,
      );
    },
  );

  bifrost.commands.register(
    'bpmn.landscape.diff.openDiffOriginalDataVsCurrentData',
    (editorDocument?: EditorDocument) => {
      const mapDocument = editorDocument ?? bifrost.editors.getFocusedEditorDocument();
      assertNotNull(mapDocument, 'mapDocument');
      bifrost.editors.focusOrOpenEditorDocument(
        buildDiffUri(mapDocument.uri, mapDocument.uri, 'current'),
        `Diff: ${mapDocument.label} (Working copy)`,
      );
    },
    {
      visibleInSearch: true,
      description: 'Diff: Show diff for working copy changes (Landscape map)',
      enabledWhen: () => bifrost.editors.getFocusedEditorDocument()?.documentType === LANDSCAPE_DOCUMENT_TYPE,
    },
  );

  bifrost.commands.register('bpmn.landscape.diff.openDiffCurrentDataVsOriginalData', (editorDocument: EditorDocument) =>
    bifrost.editors.focusOrOpenEditorDocument(
      buildDiffUri(editorDocument.uri, editorDocument.uri, 'original', {}, 'current'),
      `Diff: ${editorDocument.label} (Working copy)`,
    ),
  );

  bifrost.commands.register(
    'bpmn.landscape.diff.exportBeforeToNewFile',
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<LandscapeDiffDocumentModel>(editorDocument);
      const { beforeUri, sourceFileUri } = parseOpenInNewTabUrl(editorDocument.uri).data;
      const realUri = sourceFileUri ?? beforeUri;
      const targetFilename = await bifrost.dialog.showSaveFile({
        defaultPath: bifrost.files.isLocalFilename(realUri)
          ? bifrost.files.getLocalFilenameForUri(realUri).replace(/\.bfwmap$/i, ' (before).bfwmap')
          : `${editorDocument.label} (before).bfwmap`,
        filters: [{ name: 'Landscape map', extensions: ['bfwmap'] }],
      });
      if (targetFilename == null || targetFilename.trim() === '') {
        return;
      }
      await bifrost.files.save(bifrost.files.getUriForFilename(targetFilename), model.getBeforeText());
    },
    { enabledWhen: (editorDocument: EditorDocument) => editorDocument?.documentType === DIFF_DOCUMENT_TYPE },
  );

  for (const [commandName, viewMode] of [
    ['bpmn.landscape.diff.showVisualView', 'visual'],
    ['bpmn.landscape.diff.showXmlView', 'xml'],
  ] as const) {
    bifrost.commands.register(
      commandName,
      async (editorDocument: EditorDocument) => {
        const model = await bifrost.editors.getEditorDocumentModel<LandscapeDiffDocumentModel>(editorDocument);
        model.setViewMode(viewMode);
      },
      { enabledWhen: (editorDocument: EditorDocument) => editorDocument.documentType === DIFF_DOCUMENT_TYPE },
    );
  }

  bifrost.commands.register(
    'bpmn.landscape.diff.showChangeSummaryDialog',
    async (editorDocument?: EditorDocument) => {
      const documentToSummarize = editorDocument ?? bifrost.editors.getFocusedEditorDocument();
      assertNotNull(documentToSummarize, 'editorDocument');
      const model = await bifrost.editors.getEditorDocumentModel<LandscapeDiffDocumentModel>(documentToSummarize);
      const diff = model.getDiff();
      if (diff == null) {
        bifrost.notifications.open('Diff data is not yet available.');
        return;
      }

      const fileName = model.getAfterFilename() || 'unknown';
      const summaryText = formatLandscapeDiffAsMarkdown(diff, fileName, { includeHeading: false });
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
          bifrost.notifications.open({ type: 'error', content: 'Failed to copy to clipboard.', source: 'Landscapes' });
        }
      }
    },
    {
      enabledWhen: (editorDocument?: EditorDocument) =>
        (editorDocument ?? bifrost.editors.getFocusedEditorDocument())?.documentType === DIFF_DOCUMENT_TYPE,
    },
  );

  bifrost.commands.register(
    'bpmn.landscape.diff.openHistoryPreview',
    (uri: string, commitHash: string, message: string, author: string, date: string) => {
      const fragmentUri = getUrlForOpenInNewTab(HISTORY_PREVIEW_DOCUMENT_TYPE, uri, commitHash, {
        commitHash,
        message,
        author,
        date,
      });
      bifrost.editors.focusOrOpenEditorDocument(
        fragmentUri,
        `${bifrost.files.getLocalBasename(uri)} @ ${commitHash.substring(0, 7)}`,
      );
    },
  );

  bifrost.commands.register(
    'bpmn.landscape.diff.historyPreview.changeViewMode',
    (model: LandscapeHistoryPreviewDocumentModel, newMode: 'preview' | 'diff') => model.setViewerMode(newMode),
    { enabledWhen: (model: LandscapeHistoryPreviewDocumentModel) => model != null && model.isReadyForInteraction() },
  );

  bifrost.commands.register(
    'bpmn.landscape.diff.history.restoreFile',
    async (editorDocument: EditorDocument) => {
      const model = await bifrost.editors.getEditorDocumentModel<LandscapeHistoryPreviewDocumentModel>(editorDocument);
      const historicalText = model.getHistoricalText();
      if (!historicalText) {
        bifrost.notifications.open({
          type: 'error',
          content: 'Historical data is not available.',
          source: 'Landscapes',
        });
        return;
      }
      await bifrost.commands.executeCommand('git.restoreFileContent', [
        editorDocument,
        model.getParentUri(),
        historicalText,
        model.getFilename(),
        model.getShortHash(),
      ]);
    },
    { enabledWhen: (editorDocument: EditorDocument) => editorDocument.documentType === HISTORY_PREVIEW_DOCUMENT_TYPE },
  );

  registerZoomCommands(bifrost, DIFF_DOCUMENT_TYPE);
  registerZoomCommands(bifrost, HISTORY_PREVIEW_DOCUMENT_TYPE);

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'bpmn-landscape/panes/properties/ChangeOverview',
      'bpmn-landscape/pane-providers/properties/ChangeOverview',
      LandscapeChangeOverview,
    ),
  ]);

  bifrost.helpTexts.registerHelpText('bpmn-landscape/diff', require('../texts/landscape-diff.md'));
}
