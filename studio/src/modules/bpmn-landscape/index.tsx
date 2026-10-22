import type { Bifrost } from '#bifrost/Bifrost';

import LandscapeMapDocumentModel from './LandscapeMapDocumentModel';
import LandscapeMapRenderer from './LandscapeMapRenderer';
import { registerLandscapeCommands } from './commands';
import * as LandscapePropertiesPane from './panes/LandscapePropertiesPane';
import * as ProcessesPane from './panes/ProcessesPane';

const LANDSCAPES_PAGE_ID = 'discover/landscapes';
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
    uriMatch: /\.bfwmap$/,
    modelKey: 'LandscapeMapDocumentModel',
    modelConstructor: LandscapeMapDocumentModel,
    rendererKey: 'LandscapeMapRenderer',
    rendererConstructor: LandscapeMapRenderer,
    icon: 'bpmn-landscape/document-type/map',
  });

  bifrost.solution.registerDefaultIncludedFiles(['**/*.bfwmap']);

  bifrost.panes.registerPaneGroup(
    'left',
    'landscapes',
    [
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
