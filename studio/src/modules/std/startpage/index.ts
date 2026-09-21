import type { Bifrost } from '#bifrost/Bifrost';

import type { Menu, MenuItem } from '@elraptorus/bfw_studio_sdk';

import StartpageRenderer from './StartpageRenderer';

export type StartpageCardDescriptor = {
  key: string;
  icon: string;
  title: string;
  description: string;
  command: string;
  commandArgs?: any[];
  testId?: string;
};

export function loadStartPage(bifrost: Bifrost): void {
  bifrost.icons.registerIcons({
    'startpage/document-type/default': 'ph ph-house startpage__document--tab-icon',
  });

  bifrost.editors.registerDocumentType('startpage', {
    uriMatch: /^about:start$/,
    modelKey: null,
    modelConstructor: null,
    rendererKey: 'StartpageRenderer',
    rendererConstructor: StartpageRenderer,
    icon: 'startpage/document-type/default',
  });

  if (bifrost.menus.isMenuRegistered('app')) {
    bifrost.menus.registerMenuModifier('std/application/main', (mainMenu: Menu, bifrost: Bifrost): Menu => {
      const newMenuItems: MenuItem[] = [
        {
          type: 'command',
          label: `About ${bifrost.env.productName}`,
          id: 'app/about',
          command: 'std.aboutpage.open',
        },
        { type: 'divider' },
      ];

      return bifrost.menus.prependToSubmenu(mainMenu, 'app', newMenuItems);
    });
  }

  bifrost.commands.register(
    'std.startpage.open',
    () => {
      bifrost.editors.focusOrOpenEditorDocument('about:start', 'Welcome');
    },
    { visibleInSearch: true, description: ['View: Start page', 'Welcome', 'Home'] },
  );

  // ─── Contribution API: Hero Cards ──────────────────
  const heroCards: StartpageCardDescriptor[] = [];
  bifrost.commands.register('std.startpage.registerHeroCard', (descriptor: StartpageCardDescriptor) => {
    heroCards.push(descriptor);
  });
  bifrost.commands.register('std.startpage.getHeroCards', () => heroCards);

  // ─── Contribution API: Action Cards ────────────────
  const actionCards: StartpageCardDescriptor[] = [];
  bifrost.commands.register('std.startpage.registerActionCard', (descriptor: StartpageCardDescriptor) => {
    actionCards.push(descriptor);
  });
  bifrost.commands.register('std.startpage.getActionCards', () => actionCards);

  // ─── Backward compat: legacy render injection ─────
  const startPageExtraRenderer: React.JSX.Element[] = [];
  bifrost.commands.register('std.startpage.setExtraRenderer', (reactComponent: React.JSX.Element) => {
    startPageExtraRenderer.push(reactComponent);
  });
  bifrost.commands.register('std.startpage.getExtraRenderer', () => startPageExtraRenderer);

  bifrost.settings.register({
    'startpage.general.openOnStartupIfEmpty': {
      category: 'Start Page',
      type: 'boolean',
      label: 'Open Start Page on Startup',
      description: 'Show the start page when the Studio opens with no documents.',
      default: true,
    },
  });

  const openOnStartup = bifrost.settings.get('startpage.general.openOnStartupIfEmpty');

  if (openOnStartup) {
    bifrost.events.on('ready', () => {
      const openEditorDocuments = bifrost.editors.getOpenEditorDocuments();
      if (openEditorDocuments.length !== 0) {
        return;
      }

      bifrost.commands.executeCommand('std.startpage.open');
    });
  }
}
