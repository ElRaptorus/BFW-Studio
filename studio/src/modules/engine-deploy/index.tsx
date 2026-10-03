import type { Bifrost } from '#bifrost/Bifrost';

import type { Menu } from '@elraptorus/bfw_studio_sdk';

import { registerDeployPlanCommands } from './commands';
import DeployPlanDocumentModel from './models/DeployPlanDocumentModel';
import * as DeployExplorerPane from './panes/DeployExplorerPane';
import * as DeployItemDetailsPane from './panes/DeployItemDetailsPane';
import DeployPlanRenderer from './renderers/DeployPlanRenderer';

const ADD_TO_PLAN_MENU: Menu = [
  {
    type: 'command',
    label: 'Add to Deployment',
    id: 'engine/deploy-explorer/item/add',
    command: 'engine.deploy.addSelectedToPlan',
  },
];

export function onLoad(bifrost: Bifrost): void {
  bifrost.icons.registerIcons({
    'engine-deploy/page/plan': 'ph ph-paper-plane-tilt',
    'engine-deploy/document-type/plan': 'ph-duotone ph-paper-plane-tilt',
  });

  bifrost.categories.registerPage({
    id: 'deploy/plan',
    categoryId: 'deploy',
    label: 'Plan',
    icon: 'engine-deploy/page/plan',
    order: 0,
    paneAreas: ['left', 'right', 'bottom'],
    defaultDocumentUri: 'deploy://plan',
    editorTabsVisible: false,
  });

  bifrost.editors.registerDocumentType('engine-deploy-plan', {
    page: 'deploy/plan',
    uriMatch: /^deploy:\/\/plan$/,
    modelKey: 'DeployPlanDocumentModel',
    modelConstructor: DeployPlanDocumentModel,
    rendererKey: 'DeployPlanRenderer',
    rendererConstructor: DeployPlanRenderer,
    icon: 'engine-deploy/document-type/plan',
  });

  bifrost.panes.registerPaneGroup(
    'left',
    'deploy-explorer',
    [
      bifrost.panes.getPaneViaPaneProvider(
        'pane/left/deploy-explorer',
        'engine-deploy/pane-providers/DeployExplorerPane',
        DeployExplorerPane,
      ),
    ],
    { pages: ['deploy/plan'] },
  );

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'pane/right/deploy-item-details',
      'engine-deploy/pane-providers/DeployItemDetailsPane',
      DeployItemDetailsPane,
    ),
  ]);

  bifrost.menus.registerMenu('engine/deploy-explorer/item', () => ADD_TO_PLAN_MENU);
  bifrost.menus.registerMenu('engine/deploy-explorer/multi-selection', () => ADD_TO_PLAN_MENU);

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: '*',
    bindings: { '.kbm-deploy-explorer': { enter: 'engine.deploy.addSelectedToPlan' } },
  });

  registerDeployPlanCommands(bifrost);
}
