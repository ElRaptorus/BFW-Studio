import type { Bifrost } from '#bifrost/Bifrost';
import type { EngineConnectionManager } from '#modules/engine-core';

import './engine-model-viewer.scss';
import initializeCommands from './initializers/initializeCommands';
import initializeDocumentTypes from './initializers/initializeDocumentTypes';
import initializeKeyBindings from './initializers/initializeKeyBindings';
import initializeMenus from './initializers/initializeMenus';
import initializePanes from './initializers/initializePanes';
import initializeRunMenu from './initializers/initializeRunMenu';

export async function onLoad(bifrost: Bifrost): Promise<void> {
  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');

  initializeDocumentTypes(bifrost);
  initializeCommands(bifrost, connectionManager);
  initializeMenus(bifrost);
  initializePanes(bifrost);
  initializeKeyBindings(bifrost);
  initializeRunMenu(bifrost);
}
