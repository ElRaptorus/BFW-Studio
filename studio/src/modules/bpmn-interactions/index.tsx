import type { Bifrost } from '#bifrost/Bifrost';

import type { Menu } from '@elraptorus/bfw_studio_sdk';

import InteractionsDocumentModel, { INTERACTIONS_PAGE_ID, INTERACTIONS_URI } from './InteractionsDocumentModel';
import InteractionsDocumentRenderer from './InteractionsDocumentRenderer';
import { registerInteractionsCommands, registerInteractionsTestCommands } from './commands';
import * as InteractionsProcessesPane from './panes/InteractionsProcessesPane';
import * as InteractionsPropertiesPane from './panes/InteractionsPropertiesPane';

export const INTERACTIONS_DOCUMENT_TYPE = 'bpmn-interactions-map';
const EDITOR_SELECTOR = `.kbm-editor[data-editor-document-type=${INTERACTIONS_DOCUMENT_TYPE}]`;
const FOCUS_MODE_KEY = 'f';

export function onLoad(bifrost: Bifrost): void {
  bifrost.helpTexts.registerHelpText(INTERACTIONS_PAGE_ID, require('./texts/interactions.md'));

  bifrost.icons.registerIcons({
    'bpmn-interactions/page/interactions': 'ph ph-graph',
    'bpmn-interactions/document-type/map': 'ph-duotone ph-graph',
  });

  bifrost.settings.register({
    'bpmn.interactions.layout': {
      category: 'Interactions',
      scope: 'solution',
      type: 'string',
      label: 'Layout',
      description: 'How message and signal lines are drawn between processes.',
      default: 'direct',
      enum: ['direct', 'stations'],
      enumLabels: { direct: 'Direct', stations: 'Stations' },
    },
    'bpmn.interactions.hideProcessesWithoutInteraction': {
      category: 'Interactions',
      scope: 'solution',
      type: 'boolean',
      label: 'Hide processes without interaction',
      description: 'When generating, omit selected processes that have no message or signal line in the current view.',
      default: false,
    },
  });

  bifrost.categories.registerPage({
    id: INTERACTIONS_PAGE_ID,
    categoryId: 'discover',
    label: 'Interactions',
    icon: 'bpmn-interactions/page/interactions',
    order: 1,
    paneAreas: ['left', 'right'],
    defaultDocumentUri: INTERACTIONS_URI,
    editorTabsVisible: false,
  });

  bifrost.editors.registerDocumentType(INTERACTIONS_DOCUMENT_TYPE, {
    page: INTERACTIONS_PAGE_ID,
    uriMatch: /^interactions:\/\/solution$/,
    modelKey: 'InteractionsDocumentModel',
    modelConstructor: InteractionsDocumentModel,
    rendererKey: 'InteractionsDocumentRenderer',
    rendererConstructor: InteractionsDocumentRenderer,
    icon: 'bpmn-interactions/document-type/map',
  });

  bifrost.panes.registerPaneGroup(
    'left',
    'interactions',
    [
      bifrost.panes.getPaneViaPaneProvider(
        'discover/interactions/processes',
        'bpmn-interactions/pane-providers/InteractionsProcessesPane',
        InteractionsProcessesPane,
      ),
    ],
    { label: 'Processes', icon: 'bpmn-interactions/page/interactions', pages: [INTERACTIONS_PAGE_ID] },
  );

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'discover/interactions/properties',
      'bpmn-interactions/pane-providers/InteractionsPropertiesPane',
      InteractionsPropertiesPane,
    ),
  ]);

  registerInteractionsCommands(bifrost);

  if (process.env.APP_TEST === 'true') {
    registerInteractionsTestCommands(bifrost);
  }

  bifrost.menus.registerMenu('bpmn/interactions/element', (elementId: string | null): Menu => {
    if (elementId == null) {
      return [];
    }
    const model = getFocusedInteractionsModel(bifrost);
    const element = model?.resolveCanvasElement(elementId);
    const menu: Menu = [];
    if (model?.resolveBpmnTarget(elementId) != null) {
      menu.push({
        type: 'command',
        label: 'Open in Designer',
        id: 'bpmn/interactions/element/open',
        command: 'bpmn.interactions.openElement',
        commandArgs: [elementId],
      });
      menu.push({
        type: 'command',
        label: 'Open element in text editor',
        id: 'bpmn/interactions/element/open-text',
        command: 'bpmn.interactions.openElementInTextEditor',
        commandArgs: [elementId],
      });
    }
    if (element != null && 'partnersOutsideView' in element && element.partnersOutsideView.length > 0) {
      menu.push({
        type: 'command',
        label: 'Add partners outside the view',
        id: 'bpmn/interactions/element/add-partners',
        command: 'bpmn.interactions.addPartnersOutsideView',
        commandArgs: [elementId],
      });
    }
    menu.push({
      type: 'command',
      label: model?.resolveBpmnTarget(elementId) == null ? 'Copy name' : 'Copy id',
      id: 'bpmn/interactions/element/copy-id',
      command: 'bpmn.interactions.copySelectedElementId',
      commandArgs: [elementId],
    });
    return menu;
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'macos',
    bindings: {
      [EDITOR_SELECTOR]: {
        'cmd-f': 'bpmn.interactions.find',
        [FOCUS_MODE_KEY]: 'bpmn.interactions.toggleFocusMode',
      },
    },
  });

  for (const operatingSystem of ['windows', 'linux'] as const) {
    bifrost.keybindings.registerKeyBindings({
      client: '*',
      os: operatingSystem,
      bindings: {
        [EDITOR_SELECTOR]: {
          'ctrl-f': 'bpmn.interactions.find',
          [FOCUS_MODE_KEY]: 'bpmn.interactions.toggleFocusMode',
        },
      },
    });
  }
}

function getFocusedInteractionsModel(bifrost: Bifrost): InteractionsDocumentModel | null {
  const editorDocument = bifrost.editors.getFocusedEditorDocument();
  const model = editorDocument == null ? null : bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
  return model instanceof InteractionsDocumentModel ? model : null;
}
