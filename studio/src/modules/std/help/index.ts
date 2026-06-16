import type { Bifrost } from '#bifrost/Bifrost';

import { HelpTextDocumentModel } from './HelpTextDocumentModel';
import { HelpTextDocumentRenderer } from './HelpTextDocumentRenderer';
import { initializeHelpCommands } from './initializers/initializeHelpCommands';

export const DEFAULT_HELP_TEXT_ID = 'home';

export function loadHelp(bifrost: Bifrost): void {
  bifrost.editors.registerDocumentType('help', {
    uriMatch: /^help:\/\/(.+)$/,
    modelKey: 'HelpTextDocumentModel',
    modelConstructor: HelpTextDocumentModel,
    rendererKey: 'HelpTextDocumentRenderer',
    rendererConstructor: HelpTextDocumentRenderer,
    icon: 'help/document-type/default',
  });

  bifrost.icons.registerIcons({
    'help/document-type/default': 'ph-duotone ph-question help-icon',
  });

  bifrost.helpTexts.registerHelpText(DEFAULT_HELP_TEXT_ID, require('./texts/home.md'));

  bifrost.helpTexts.registerHelpText('std/inspectors/editor_document', require('./texts/home.md'));

  initializeHelpCommands(bifrost);
}
