import type { Bifrost } from '#bifrost/Bifrost';

import type { Menu } from '@elraptorus/bfw_studio_sdk';

import LandscapeMapDocumentModel from './LandscapeMapDocumentModel';
import LandscapeMapRenderer from './LandscapeMapRenderer';
import { registerLandscapeCommands } from './commands';
import { getMapOpenRefusal, LANDSCAPES_PAGE_ID, LANDSCAPES_VIEW_ID } from './landscapeFolder';
import { LandscapeFolderHint } from './panes/LandscapeFolderHint';
import * as LandscapePropertiesPane from './panes/LandscapePropertiesPane';
import * as ProcessesPane from './panes/ProcessesPane';

const MAPS_EXPLORER_ID = 'landscapes';
const MAP_URI_PATTERN = /\.bfwmap$/;
const EDITOR_SELECTOR = '.kbm-editor[data-editor-document-type=bpmn-landscape-map]';
const FOCUS_MODE_KEY = 'f';

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
  bifrost.helpTexts.registerHelpText(LANDSCAPES_PAGE_ID, require('./texts/landscapes.md'));

  bifrost.icons.registerIcons({
    'bpmn-landscape/page/landscapes': 'ph ph-map-trifold',
    'bpmn-landscape/document-type/map': 'ph-duotone ph-map-trifold',
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

  bifrost.editors.registerDocumentType('bpmn-landscape-map', {
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

  bifrost.solution.registerDefaultIncludedFiles(['**/*.bfwmap']);
  bifrost.events.on('solutionChanged', () => void closeMapsOutsideLandscapeFolder(bifrost));

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

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'macos',
    bindings: {
      [EDITOR_SELECTOR]: {
        backspace: 'bpmn.landscape.deleteSelection',
        'cmd-c': 'bpmn.landscape.copySelection',
        'cmd-v': 'bpmn.landscape.paste',
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
          [FOCUS_MODE_KEY]: 'bpmn.landscape.toggleFocusMode',
          ...SELECTION_KEYS,
        },
      },
    });
  }
}

let closingMaps = false;

/** Closes the open maps the current solution would refuse to open; unsaved changes are asked about as usual. */
async function closeMapsOutsideLandscapeFolder(bifrost: Bifrost): Promise<void> {
  if (closingMaps) {
    return;
  }
  const refusedMaps = bifrost.editors
    .getOpenEditorDocuments()
    .filter(
      (editorDocument) =>
        MAP_URI_PATTERN.test(editorDocument.uri) && getMapOpenRefusal(bifrost, editorDocument.uri) != null,
    );
  if (refusedMaps.length === 0) {
    return;
  }
  closingMaps = true;
  try {
    await bifrost.editors.closeEditorDocumentsUntilUserCancels(refusedMaps);
  } finally {
    closingMaps = false;
  }
}
