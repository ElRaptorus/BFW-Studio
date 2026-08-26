import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogOptions } from '#bifrost/contracts/DialogTypes';

import DefaultSettingsRenderer from './DefaultSettingsDocumentRenderer';
import KeyBindingsDocumentRenderer from './KeyBindingsDocumentRenderer';
import SettingsGuiDocumentRenderer from './SettingsGuiDocumentRenderer';
import SettingsJsonDocumentRenderer from './SettingsJsonDocumentRenderer';
import UserSettingsDocumentModel from './UserSettingsDocumentModel';
import { requestCategoryNavigation } from './settingsNavigation';

export function loadSettings(bifrost: Bifrost): void {
  bifrost.editors.registerDocumentType('settings-gui', {
    uriMatch: /^about:settings$/,
    modelKey: null,
    modelConstructor: null,
    rendererKey: 'SettingsGuiRenderer',
    rendererConstructor: SettingsGuiDocumentRenderer,
    icon: 'settings/editor-tab/user-settings',
  });

  bifrost.editors.registerDocumentType('settings-json', {
    uriMatch: /^about:settings-json$/,
    modelKey: 'SettingsDocumentModel',
    modelConstructor: UserSettingsDocumentModel,
    rendererKey: 'SettingsJsonRenderer',
    rendererConstructor: SettingsJsonDocumentRenderer,
    icon: 'settings/editor-tab/user-settings-json',
  });

  bifrost.editors.registerDocumentType('default-settings', {
    uriMatch: /^about:default-settings$/,
    modelKey: null,
    modelConstructor: null,
    rendererKey: 'DefaultSettingsRenderer',
    rendererConstructor: DefaultSettingsRenderer,
    icon: 'settings/editor-tab/default',
  });

  bifrost.editors.registerDocumentType('key-bindings', {
    uriMatch: /^about:key-bindings$/,
    modelKey: null,
    modelConstructor: null,
    rendererKey: 'KeyBindingsDocumentRenderer',
    rendererConstructor: KeyBindingsDocumentRenderer,
    icon: 'settings/editor-tab/keybindings',
  });

  bifrost.icons.registerIcons({
    'settings/editor-tab/default': 'ph ph-list settings__editor--tab-icon',
    'settings/editor-tab/user-settings': 'ph ph-sliders settings__editor--tab-icon',
    'settings/editor-tab/user-settings-json': 'ph ph-brackets-curly settings__editor--tab-icon',
    'settings/editor-tab/keybindings': 'ph ph-gear settings__editor--tab-icon',
    'settings/editor-toolbar/reset': 'ph ph-trash',
    'settings/editor-toolbar/open-gui': 'ph ph-sliders-horizontal',
    'settings/editor-toolbar/open-json': 'ph ph-brackets-curly',
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'macos',
    bindings: {
      body: {
        'cmd-,': 'std.settings.openUserSettings',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'windows',
    bindings: {
      body: {
        'ctrl-,': 'std.settings.openUserSettings',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'linux',
    bindings: {
      body: {
        'ctrl-,': 'std.settings.openUserSettings',
      },
    },
  });

  bifrost.commands.register(
    'std.settings.openDefaults',
    () => {
      bifrost.editors.focusOrOpenEditorDocument('about:default-settings', 'Default Settings');
    },
    { visibleInSearch: true, description: 'View: Default Settings' },
  );

  bifrost.commands.register(
    'std.settings.openUserSettings',
    () => {
      bifrost.editors.focusOrOpenEditorDocument('about:settings', 'Settings');
    },
    { visibleInSearch: true, description: 'View: Settings' },
  );

  bifrost.commands.register(
    'std.settings.openUserSettingsJson',
    () => {
      bifrost.editors.focusOrOpenEditorDocument('about:settings-json', 'Settings (JSON)');
    },
    { visibleInSearch: true, description: 'View: Settings (JSON)' },
  );

  bifrost.commands.register(
    'std.settings.openKeyBindings',
    () => {
      bifrost.editors.focusOrOpenEditorDocument('about:key-bindings', 'Key Bindings');
    },
    { visibleInSearch: true, description: 'View: Key Bindings' },
  );

  bifrost.commands.register('std.settings.openUserSettingsAtCategory', (category: string) => {
    bifrost.editors.focusOrOpenEditorDocument('about:settings', 'Settings');
    requestCategoryNavigation(category);
  });

  bifrost.commands.register('std.settings.resetToDefault', async () => {
    const dialogOptions: DialogOptions = {
      title: 'Reset settings',
      content: 'This will reset your settings. Proceed?',
      actions: ['cancel', { response: 'okay', label: 'Yes, reset my settings', default: true }],
    };
    const dialogResult = await bifrost.dialog.open(dialogOptions);

    if (dialogResult.response === 'okay') {
      bifrost.settings.resetToDefault();
    }
  });

  bifrost.menus.registerMenuModifier('std/application/main', async (mainMenu) => {
    const menu = await mainMenu;
    return bifrost.menus.insertAfterMenuItem(menu, 'view/command-search', [
      { type: 'divider' },
      {
        type: 'command',
        id: 'view/user-settings',
        label: 'Settings',
        command: 'std.settings.openUserSettings',
      },
      {
        type: 'command',
        id: 'view/user-settings-json',
        label: 'Settings (JSON)',
        command: 'std.settings.openUserSettingsJson',
      },
      {
        type: 'command',
        id: 'view/default-settings',
        label: 'Default Settings',
        command: 'std.settings.openDefaults',
      },
    ]);
  });
}
