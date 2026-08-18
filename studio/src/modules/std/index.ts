import type { Bifrost } from '#bifrost/Bifrost';
import DefaultDocumentInspectorFragmentRenderer from '#components/panes/inspectors/DefaultDocumentInspector/DefaultDocumentInspectorFragmentRenderer';

import { loadAboutPage } from './aboutpage/index';
import { loadHelp } from './help/index';
import { initializeClickModifierKeys } from './initializers/initializeClickModifierKeys';
import { initializeCommands } from './initializers/initializeCommands';
import { initializeFileExplorerAutoReveal } from './initializers/initializeFileExplorerAutoReveal';
import { initializeIcons } from './initializers/initializeIcons';
import { initializeKeyBindings } from './initializers/initializeKeyBindings';
import { initializeMenuBarItems } from './initializers/initializeMenuBarItems';
import { initializeMenus } from './initializers/initializeMenus';
import { initializePanes } from './initializers/initializePanes';
import { initializeStatusBarItems } from './initializers/initializeStatusBarItems';
import { loadSettings } from './settings/index';
import { loadStartPage } from './startpage/index';

export async function onLoad(bifrost: Bifrost): Promise<void> {
  initializeIcons(bifrost);

  bifrost.theme.registerTheme({
    id: 'light',
    label: 'Bifrost Day',
    type: 'light',
  });

  bifrost.theme.registerTheme({
    id: 'dark',
    label: 'Bifrost Night',
    type: 'dark',
  });

  bifrost.editors.registerDocumentType('Default.Document.Inspector.Item', {
    uriMatch: /^fragment\+default\.document\.inspector\.item:/i,
    modelKey: null,
    rendererKey: 'DefaultDocumentInspectorFragmentRenderer',
    rendererConstructor: DefaultDocumentInspectorFragmentRenderer,
    icon: 'std/inspector/document/default/fragment',
  });

  bifrost.settings.register({
    'std.editor.askConfirmationForOpeningUriInBrowser': {
      category: 'General',
      type: 'boolean',
      label: 'Confirm Before Opening URLs in Browser',
      description: 'Show a confirmation dialog before opening external URLs in the system browser.',
      default: true,
    },
    'std.solution.openDirectory.rememberChoice': {
      category: 'General',
      type: 'boolean',
      label: 'Remember Open Directory Choice',
      description: 'Remember the last choice when opening a directory (new window vs. current window).',
      default: false,
    },
    'std.solution.openDirectory.defaultChoice': {
      category: 'General',
      type: 'string',
      label: 'Default Open Directory Choice',
      description: 'The default action when opening a directory.',
      default: 'open-new-window',
      enum: ['open-new-window', 'open-in-current-window'],
      enumLabels: {
        'open-new-window': 'Open in New Window',
        'open-in-current-window': 'Open in Current Window',
      },
    },
    'std.fileExplorer.externalFolderDrop.rememberChoice': {
      category: 'General',
      type: 'boolean',
      label: 'Remember External Folder Drop Choice',
      description: 'Remember the last choice when dropping an external folder into the file explorer.',
      default: false,
    },
    'std.fileExplorer.externalFolderDrop.defaultChoice': {
      category: 'General',
      type: 'string',
      label: 'Default External Folder Drop Action',
      description: 'The default action when dropping an external folder into the file explorer.',
      default: 'copy',
      enum: ['copy', 'move', 'link'],
      enumLabels: {
        copy: 'Copy',
        move: 'Move',
        link: 'Link',
      },
    },
    'std.explorer.cursorFollowsTabs': {
      category: 'File Explorer',
      type: 'boolean',
      label: 'Cursor Follows Tabs',
      description: 'Automatically reveal and select the active file in the File Explorer when switching editor tabs.',
      default: true,
    },
  });

  initializeCommands(bifrost);
  initializeKeyBindings(bifrost);
  initializeClickModifierKeys(bifrost);

  initializeMenus(bifrost);

  initializeMenuBarItems(bifrost);
  initializeStatusBarItems(bifrost);

  initializePanes(bifrost);
  initializeFileExplorerAutoReveal(bifrost);

  loadSettings(bifrost);
  loadHelp(bifrost);
  loadAboutPage(bifrost);
  loadStartPage(bifrost);
}
