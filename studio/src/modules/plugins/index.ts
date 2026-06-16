import type { Bifrost } from '#bifrost/Bifrost';

import PluginReadmeRenderer from './PluginReadmeRenderer';
import { initializeCommands } from './initializers/initializeCommands';
import { initializeKeyBindings } from './initializers/initializeKeyBindings';
import { initializePanes } from './initializers/initializePanes';
import { initializeSettings } from './initializers/initializeSettings';

export function onLoad(bifrost: Bifrost): void {
  bifrost.icons.registerIcons({
    'plugins/left-pane-icon': 'ph-bold ph-puzzle-piece',
    'plugins/readme/document-type': 'ph ph-book-open',
  });

  bifrost.editors.registerDocumentType('plugin-readme', {
    uriMatch: /^about:plugin-readme\//,
    modelKey: null,
    modelConstructor: null,
    rendererKey: 'PluginReadmeRenderer',
    rendererConstructor: PluginReadmeRenderer,
    icon: 'plugins/readme/document-type',
  });

  initializeSettings(bifrost);

  initializeCommands(bifrost);
  initializeKeyBindings(bifrost);
  initializePanes(bifrost);
}
