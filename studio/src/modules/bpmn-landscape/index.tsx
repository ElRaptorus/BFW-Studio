import type { Bifrost } from '#bifrost/Bifrost';
import type { SearchResult } from '#bifrost/contracts/internal/SearchTypes';

import type { Menu, MenuItem } from '@elraptorus/bfw_studio_sdk';

import LandscapeMapDocumentModel from './LandscapeMapDocumentModel';
import LandscapeMapRenderer from './LandscapeMapRenderer';
import { LandscapeSearchIndexerClient } from './LandscapeSearchIndexerClient';
import { LANDSCAPE_SOLUTION_SCAN_KEY, LandscapeSolutionScan } from './LandscapeSolutionScan';
import { registerLandscapeCommands } from './commands';
import { getMapOpenRefusal, LANDSCAPE_DOCUMENT_TYPE, LANDSCAPES_PAGE_ID, LANDSCAPES_VIEW_ID } from './landscapeFolder';
import { MapsDecorationProvider } from './mapsExplorerDecorations';
import { LandscapeFolderHint } from './panes/LandscapeFolderHint';
import * as LandscapePropertiesPane from './panes/LandscapePropertiesPane';
import * as ProcessesPane from './panes/ProcessesPane';
import { LandscapeApiBridge } from './plugin-api/LandscapeApiBridge';
import { landscapeModelerModuleRegistry } from './plugin-api/landscapePluginModules';

const MAPS_EXPLORER_ID = 'landscapes';
const MAP_URI_PATTERN = /\.bfwmap$/;
const EDITOR_SELECTOR = '.kbm-editor[data-editor-document-type=bpmn-landscape-map]';
const FOCUS_MODE_KEY = 'f';
const CREATE_MAP_COMMAND = 'bpmn.landscape.createMapFromProcesses';

const SELECTION_KEYS = {
  left: 'bpmn.landscape.moveSelectionLeft',
  'shift-left': 'bpmn.landscape.moveSelectionLeftAccelerated',
  right: 'bpmn.landscape.moveSelectionRight',
  'shift-right': 'bpmn.landscape.moveSelectionRightAccelerated',
  up: 'bpmn.landscape.moveSelectionUp',
  'shift-up': 'bpmn.landscape.moveSelectionUpAccelerated',
  down: 'bpmn.landscape.moveSelectionDown',
  'shift-down': 'bpmn.landscape.moveSelectionDownAccelerated',
};

export function onLoad(bifrost: Bifrost): void {
  bifrost.plugins.registerApiNamespace((context) => new LandscapeApiBridge(bifrost, context));

  bifrost.helpTexts.registerHelpText(LANDSCAPES_PAGE_ID, require('./texts/landscapes.md'));

  bifrost.icons.registerIcons({
    'bpmn-landscape/page/landscapes': 'ph ph-map-trifold',
    'bpmn-landscape/document-type/map': 'ph-duotone ph-map-trifold',
    'bpmn-landscape/search-result/types/band': 'ph ph-rows',
    'bpmn-landscape/search-result/types/group': 'ph ph-selection',
    'bpmn-landscape/search-result/types/process': 'ph ph-flow-arrow',
    'bpmn-landscape/search-result/types/placeholder': 'ph ph-dots-three-outline',
    'bpmn-landscape/search-result/types/mapLink': 'ph ph-map-trifold',
    'bpmn-landscape/search-result/types/note': 'ph ph-note',
  });

  bifrost.categories.registerPage({
    id: LANDSCAPES_PAGE_ID,
    categoryId: 'discover',
    label: 'Landscapes',
    icon: 'bpmn-landscape/page/landscapes',
    order: 0,
    paneAreas: ['left', 'right'],
    editorTabsVisible: true,
  });

  bifrost.editors.registerDocumentType(LANDSCAPE_DOCUMENT_TYPE, {
    page: LANDSCAPES_PAGE_ID,
    uriMatch: MAP_URI_PATTERN,
    modelKey: 'LandscapeMapDocumentModel',
    modelConstructor: LandscapeMapDocumentModel,
    rendererKey: 'LandscapeMapRenderer',
    rendererConstructor: LandscapeMapRenderer,
    icon: 'bpmn-landscape/document-type/map',
    canOpen: (uri: string) => {
      const refusal = getMapOpenRefusal(bifrost, uri);
      return refusal == null ? { documentCanBeOpened: true } : { documentCanBeOpened: false, error: refusal };
    },
  });

  bifrost.commands.register('bpmn.landscape.modeler.registerModule', (module: any) => {
    landscapeModelerModuleRegistry.register(module);
  });

  bifrost.settings.register({
    'bpmn.landscape.showGrid': {
      category: 'Landscapes',
      scope: 'project',
      type: 'boolean',
      label: 'Show Grid',
      description: 'Display a grid overlay on the landscape map canvas.',
      default: true,
    },
  });

  bifrost.menus.registerMenuModifier('std/application/main', async (mainMenu: Promise<Menu>): Promise<Menu> => {
    const menu = await mainMenu;
    return bifrost.menus.insertAfterMenuItem(menu, 'view/editor-tabs', [
      {
        type: 'menu',
        label: 'Landscape Map Editor',
        id: 'view/landscape-editor',
        submenu: [
          {
            type: 'command',
            label: 'Show Grid',
            checked: bifrost.settings.get('bpmn.landscape.showGrid') !== false,
            id: 'view/landscape-editor/show-grid',
            command: 'bpmn.landscape.toggleShowGrid',
          },
        ],
      },
    ]);
  });

  bifrost.searchIndex.registerSearchIndexerWorkerClient(LANDSCAPE_DOCUMENT_TYPE, new LandscapeSearchIndexerClient());
  bifrost.searchIndex.registerSearchResultFilter(
    LANDSCAPE_DOCUMENT_TYPE,
    (searchResult: SearchResult) => searchResult.label !== '',
  );
  bifrost.searchView.onOpenSearchResult(LANDSCAPE_DOCUMENT_TYPE, (searchResult: SearchResult) => {
    const editorDocument = bifrost.editors.focusOrOpenEditorDocument(searchResult.uri);
    void bifrost.editors
      .getEditorDocumentModel<LandscapeMapDocumentModel>(editorDocument)
      .then((model) => model.revealElement(searchResult.metadata.elementId));
  });

  bifrost.solution.registerDefaultIncludedFiles(['**/*.bfwmap']);
  const solutionScan = new LandscapeSolutionScan(bifrost);
  bifrost.registerSharedRessource(LANDSCAPE_SOLUTION_SCAN_KEY, solutionScan);
  const mapsDecorationProvider = new MapsDecorationProvider();
  bifrost.explorers.registerDecorationProvider(mapsDecorationProvider, [MAPS_EXPLORER_ID]);
  solutionScan.onDidChange(() => {
    const snapshot = solutionScan.getSnapshot();
    if (snapshot != null) {
      mapsDecorationProvider.apply(snapshot);
    }
  });
  solutionScan.start();
  bifrost.events.on('solutionChanged', () => void closeMapsOutsideLandscapeFolder(bifrost));
  // Restored documents skip `canOpen`. With a stored solution, opening it fires `solutionChanged`; without one nothing
  // else would close a restored map.
  bifrost.events.on('ready', () => {
    if (bifrost.solution.getSolution() == null) {
      void closeMapsOutsideLandscapeFolder(bifrost);
    }
  });

  bifrost.panes.registerPaneGroup(
    'left',
    'landscapes',
    [
      bifrost.explorers.register({
        id: MAPS_EXPLORER_ID,
        paneId: 'discover/landscapes/maps',
        pages: [LANDSCAPES_PAGE_ID],
        label: 'Maps',
        source: { kind: 'view', viewId: LANDSCAPES_VIEW_ID, includedFiles: ['**/*.bfwmap'] },
        headerActions: [
          {
            icon: 'ph ph-file-plus',
            tooltip: 'New Landscape Map...',
            command: 'bpmn.landscape.newMap',
            dataTestId: 'landscape-new-map',
          },
        ],
        emptyState: LandscapeFolderHint,
      }),
      bifrost.panes.getPaneViaPaneProvider(
        'discover/landscapes/landscapes',
        'bpmn-landscape/pane-providers/ProcessesPane',
        ProcessesPane,
      ),
    ],
    { label: 'Landscapes', pages: [LANDSCAPES_PAGE_ID] },
  );

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'discover/landscapes/properties',
      'bpmn-landscape/pane-providers/LandscapePropertiesPane',
      LandscapePropertiesPane,
    ),
  ]);

  for (const menuId of ['std/file-explorer/directory', 'std/file-explorer/project']) {
    bifrost.menus.registerMenuModifier(menuId, (menu: Menu, metadata: any): Menu => {
      if (metadata?.explorerId !== MAPS_EXPLORER_ID || metadata.uri == null) {
        return menu;
      }
      return [
        {
          type: 'command',
          label: 'New Landscape Map...',
          id: `${menuId}/new-landscape-map`,
          icon: 'ph ph-file-plus',
          command: 'bpmn.landscape.newMap',
          commandArgs: [metadata.uri],
        },
        { type: 'divider' },
        ...menu,
      ];
    });
  }

  registerLandscapeCommands(bifrost);

  // Opened by the canvas context menu with the clicked shape's id and type; both are `null` on the empty canvas.
  bifrost.menus.registerMenu('bpmn/landscape/element', (elementId: string | null, elementType: string | null): Menu => {
    const editorDocument = bifrost.editors.getFocusedEditorDocument();
    const isOpenable = elementType === 'process' || elementType === 'mapLink';
    // Relation lines are drawn from the solution and have no element in the file.
    const isInFile = elementType !== 'relation';
    const pasteItem: MenuItem = {
      type: 'command',
      label: 'Paste',
      id: 'bpmn/landscape/element/paste',
      command: 'bpmn.landscape.paste',
    };
    if (elementId == null) {
      return [pasteItem];
    }
    const clipboardMenu: Menu = [
      { type: 'command', label: 'Copy', id: 'bpmn/landscape/element/copy', command: 'bpmn.landscape.copySelection' },
      pasteItem,
      {
        type: 'command',
        label: 'Delete',
        id: 'bpmn/landscape/element/delete',
        command: 'bpmn.landscape.deleteSelection',
      },
    ];
    const elementMenu: Menu = [];
    if (isOpenable) {
      elementMenu.push({
        type: 'command',
        label: 'Open',
        id: 'bpmn/landscape/element/open',
        command: 'bpmn.landscape.openSelectedElement',
        commandArgs: [elementId],
      });
    }
    if (elementType === 'placeholder') {
      elementMenu.push(
        {
          type: 'command',
          label: 'Model this process…',
          id: 'bpmn/landscape/element/model-placeholder',
          command: 'bpmn.landscape.modelPlaceholder',
          commandArgs: [elementId],
        },
        {
          type: 'command',
          label: 'Link to existing process…',
          id: 'bpmn/landscape/element/link-placeholder',
          command: 'bpmn.landscape.linkPlaceholder',
          commandArgs: [elementId],
        },
      );
    }
    if (elementType === 'process' || elementType === 'placeholder' || elementType === 'note') {
      elementMenu.push({
        type: 'command',
        label: 'Change element',
        id: 'bpmn/landscape/element/change-type',
        command: 'bpmn.landscape.changeElementType',
        commandArgs: [elementId],
      });
    }
    if (isInFile && editorDocument != null) {
      elementMenu.push({
        type: 'command',
        label: 'Open element in text editor',
        id: 'bpmn/landscape/element/open-in-text-editor',
        command: 'bpmn.landscape.openElementInTextEditor',
        commandArgs: [editorDocument, elementId],
      });
    }
    return elementMenu.length === 0 ? clipboardMenu : [...clipboardMenu, { type: 'divider' }, ...elementMenu];
  });

  const PROCESSES_MENU_ID = ProcessesPane.PROCESSES_MENU_ID;
  const createMapItem = (label: string, id: string, rows: { fileUri: string; processId?: string }[]): Menu => [
    { type: 'command', label, id, icon: 'ph ph-map-trifold', command: CREATE_MAP_COMMAND, commandArgs: [rows] },
  ];
  bifrost.menus.registerMenu(`${PROCESSES_MENU_ID}/process`, (metadata: any) =>
    createMapItem('Create Map from Process...', `${PROCESSES_MENU_ID}/process/create-map`, [
      { fileUri: metadata.fileUri, processId: metadata.processId },
    ]),
  );
  bifrost.menus.registerMenu(`${PROCESSES_MENU_ID}/file`, (metadata: any) =>
    createMapItem('Create Map from File...', `${PROCESSES_MENU_ID}/file/create-map`, [{ fileUri: metadata.fileUri }]),
  );
  bifrost.menus.registerMenu(`${PROCESSES_MENU_ID}/multi-selection`, (selectedMetadata: any[]) =>
    createMapItem(
      'Create Map from Selection...',
      `${PROCESSES_MENU_ID}/multi-selection/create-map`,
      selectedMetadata.map((metadata) => ({ fileUri: metadata.fileUri, processId: metadata.processId })),
    ),
  );

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'macos',
    bindings: {
      [EDITOR_SELECTOR]: {
        backspace: 'bpmn.landscape.deleteSelection',
        'cmd-c': 'bpmn.landscape.copySelection',
        'cmd-v': 'bpmn.landscape.paste',
        'cmd-f': 'bpmn.landscape.find',
        [FOCUS_MODE_KEY]: 'bpmn.landscape.toggleFocusMode',
        ...SELECTION_KEYS,
      },
    },
  });

  for (const os of ['windows', 'linux'] as const) {
    bifrost.keybindings.registerKeyBindings({
      client: '*',
      os,
      bindings: {
        [EDITOR_SELECTOR]: {
          delete: 'bpmn.landscape.deleteSelection',
          'ctrl-c': 'bpmn.landscape.copySelection',
          'ctrl-v': 'bpmn.landscape.paste',
          'ctrl-f': 'bpmn.landscape.find',
          [FOCUS_MODE_KEY]: 'bpmn.landscape.toggleFocusMode',
          ...SELECTION_KEYS,
        },
      },
    });
  }
}

let closingMaps = false;
/** Maps with unsaved changes whose save prompt the user cancelled; they stay open until another solution opens. */
let keptOpenMapUris = new Set<string>();
let keptOpenSolutionKey: string | null = null;

/** Closes the open maps the current solution would refuse to open; unsaved changes are asked about as usual. */
async function closeMapsOutsideLandscapeFolder(bifrost: Bifrost): Promise<void> {
  if (closingMaps) {
    return;
  }
  const solution = bifrost.solution.getSolution();
  const solutionKey = solution == null ? null : (solution.solutionFileUri ?? solution.baseUri);
  if (solutionKey !== keptOpenSolutionKey) {
    keptOpenMapUris = new Set();
    keptOpenSolutionKey = solutionKey;
  }
  const refusedMaps = bifrost.editors
    .getOpenEditorDocuments()
    .filter(
      (editorDocument) =>
        MAP_URI_PATTERN.test(editorDocument.uri) &&
        !keptOpenMapUris.has(editorDocument.uri) &&
        getMapOpenRefusal(bifrost, editorDocument.uri) != null,
    );
  if (refusedMaps.length === 0) {
    return;
  }
  closingMaps = true;
  try {
    if (!(await bifrost.editors.closeEditorDocumentsUntilUserCancels(refusedMaps))) {
      const openUris = new Set(bifrost.editors.getOpenEditorDocuments().map((editorDocument) => editorDocument.uri));
      refusedMaps
        .filter((editorDocument) => editorDocument.hasUnsavedChanges && openUris.has(editorDocument.uri))
        .forEach((editorDocument) => keptOpenMapUris.add(editorDocument.uri));
    }
  } finally {
    closingMaps = false;
  }
}
