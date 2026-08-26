import type { Bifrost } from '#bifrost/Bifrost';
import type { SearchResult } from '#bifrost/contracts/internal/SearchTypes';

import DmnDocumentModel from './DmnDocumentModel';
import DmnDocumentRenderer from './DmnDocumentRenderer';
import { DmnSearchIndexerWorkerClient } from './browser/DmnSearchIndexerWorkerClient';
import { DmnSymbolIndexerWorkerClient } from './browser/DmnSymbolIndexerWorkerClient';
import { initializeDmnCommands } from './initializers/initializeDmnCommands';
import { initializeDmnFeelContext } from './initializers/initializeDmnFeelContext';
import { initializeDmnHelpTexts } from './initializers/initializeDmnHelpTexts';
import { initializeDmnMenus } from './initializers/initializeDmnMenus';
import { initializeDmnPanes } from './initializers/initializeDmnPanes';
import { initializeDmnSanitizerCommands } from './initializers/initializeDmnSanitizerCommands';
import { initializeDmnSettings } from './initializers/initializeDmnSettings';
import DmnMergeResolver from './merge/DmnMergeResolver';
import { DmnEditorDocumentInspector } from './panes/inspector/DmnEditorDocumentInspector';

export const DMN_DOCUMENT_TYPE = 'dmn';

export function onLoad(bifrost: Bifrost): void {
  bifrost.editors.registerDocumentType(DMN_DOCUMENT_TYPE, {
    uriMatch: /\.dmn$/,
    modelKey: 'DmnDocumentModel',
    modelConstructor: DmnDocumentModel,
    rendererKey: 'DmnDocumentRenderer',
    rendererConstructor: DmnDocumentRenderer,
    inspectorKey: 'DmnEditorDocumentInspector',
    inspectorConstructor: DmnEditorDocumentInspector,
    icon: 'dmn/editor-tab/dmn',
    mergeResolverKey: 'DmnMergeResolver',
    mergeResolverConstructor: DmnMergeResolver,
  });

  bifrost.solution.registerDefaultIncludedFiles(['**/*.dmn']);

  bifrost.icons.registerIcons({
    'dmn/editor-tab/dmn': 'ph-fill ph-table dmn__editor--tab-icon',
  });

  initializeDmnCommands(bifrost);
  initializeDmnPanes(bifrost);
  initializeDmnFeelContext(bifrost);
  initializeDmnSettings(bifrost);
  initializeDmnHelpTexts(bifrost);
  initializeDmnMenus(bifrost);
  initializeDmnSanitizerCommands(bifrost);

  bifrost.symbolIndex.registerSymbolIndexerWorkerClient(DMN_DOCUMENT_TYPE, new DmnSymbolIndexerWorkerClient());

  // Search indexing
  bifrost.searchIndex.registerSearchIndexerWorkerClient(DMN_DOCUMENT_TYPE, new DmnSearchIndexerWorkerClient());
  bifrost.searchIndex.registerSearchResultFilter(DMN_DOCUMENT_TYPE, (searchResult: SearchResult) => {
    return searchResult.metadata.isSelectable && searchResult.label != null && searchResult.label !== '';
  });

  bifrost.searchView.onOpenSearchResult(DMN_DOCUMENT_TYPE, (searchResult: SearchResult) => {
    const editorDocument = bifrost.editors.focusOrOpenEditorDocument(searchResult.uri);
    const elementId = searchResult.metadata.elementId;

    bifrost.editors
      .getEditorDocumentModel<DmnDocumentModel>(editorDocument)
      .then((dmnDocumentModel: DmnDocumentModel) => {
        dmnDocumentModel.onceInteractive(() => {
          dmnDocumentModel.zoomToElement(elementId);
          dmnDocumentModel.selection.selectElement(elementId);
        });
      });
  });

  // Search result icons
  bifrost.icons.registerIcons({
    'dmn/search-result/types/Decision': 'ph ph-table',
    'dmn/search-result/types/InputData': 'ph ph-sign-in',
    'dmn/search-result/types/BusinessKnowledgeModel': 'ph ph-book-open',
    'dmn/search-result/types/KnowledgeSource': 'ph ph-books',
    'dmn/search-result/types/DecisionService': 'ph ph-rectangles-four',
    'dmn/search-result/types/Definitions': 'ph-fill ph-table',
    'dmn/search-result/types/ItemDefinition': 'ph ph-code',
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'macos',
    bindings: {
      '.kbm-editor[data-editor-document-type=dmn]': {
        backspace: 'dmn.editor.deleteSelectedElements',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'windows',
    bindings: {
      '.kbm-editor[data-editor-document-type=dmn]': {
        delete: 'dmn.editor.deleteSelectedElements',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'linux',
    bindings: {
      '.kbm-editor[data-editor-document-type=dmn]': {
        delete: 'dmn.editor.deleteSelectedElements',
      },
    },
  });
}
