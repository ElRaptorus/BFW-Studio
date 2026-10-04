import type { Bifrost } from '#bifrost/Bifrost';

import type { Menu } from '@elraptorus/bfw_studio_sdk';

import {
  DEPLOY_PACKAGES_MENU_ID,
  DEPLOY_PACKAGES_SETTING,
  readDeployPackages,
  registerDeployPlanCommands,
} from './commands';
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

function buildPackagesMenu(bifrost: Bifrost): Menu {
  const packages = readDeployPackages(bifrost);
  const loadItems: Menu =
    packages.length === 0
      ? [{ type: 'command', label: 'No packages saved yet', command: 'std.internal.empty' }]
      : packages.map((deployPackage) => ({
          type: 'command',
          label: `Load '${deployPackage.name}' (${deployPackage.files.length})`,
          command: 'engine.deploy.loadPackage',
          commandArgs: [deployPackage.name],
        }));
  // The editor toolbar dropdown renders flat menus only, so no submenu here.
  const deleteItems: Menu = packages.map((deployPackage) => ({
    type: 'command',
    label: `Delete '${deployPackage.name}'`,
    command: 'engine.deploy.deletePackage',
    commandArgs: [deployPackage.name],
  }));
  return [
    ...loadItems,
    { type: 'divider' },
    { type: 'command', label: 'Save Plan as Package…', command: 'engine.deploy.savePlanAsPackage' },
    ...(deleteItems.length > 0 ? [{ type: 'divider' } as const, ...deleteItems] : []),
  ];
}

export function onLoad(bifrost: Bifrost): void {
  bifrost.helpTexts.registerHelpText('deploy/plan', require('./texts/deploy-plan.md'));

  bifrost.settings.register({
    [DEPLOY_PACKAGES_SETTING]: {
      category: 'Deploy',
      scope: 'solution',
      type: 'array',
      label: 'Deploy Packages',
      description:
        'Named sets of BPMN and DMN files for the Deploy plan. Each entry is `{ "name": string, "files": string[] }`; the file paths are relative to the solution file (or the opened folder).',
      default: [],
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', label: 'Name', description: 'Unique package name.', default: '' },
          files: {
            type: 'array',
            label: 'Files',
            description: 'Paths of the BPMN and DMN files, relative to the solution file.',
            default: [],
            items: { type: 'string' },
          },
        },
      },
    },
  });

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
        'deploy/plan/deploy-explorer',
        'engine-deploy/pane-providers/DeployExplorerPane',
        DeployExplorerPane,
      ),
    ],
    { pages: ['deploy/plan'] },
  );

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'deploy/plan/deploy-item-details',
      'engine-deploy/pane-providers/DeployItemDetailsPane',
      DeployItemDetailsPane,
    ),
  ]);

  bifrost.menus.registerMenu(DEPLOY_PACKAGES_MENU_ID, () => buildPackagesMenu(bifrost));
  bifrost.menus.registerMenu('engine/deploy-explorer/item', () => ADD_TO_PLAN_MENU);
  bifrost.menus.registerMenu('engine/deploy-explorer/multi-selection', () => ADD_TO_PLAN_MENU);

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: '*',
    bindings: { '.kbm-deploy-explorer': { enter: 'engine.deploy.addSelectedToPlan' } },
  });

  registerDeployPlanCommands(bifrost);
}
