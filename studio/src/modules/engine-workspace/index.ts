import type { Bifrost } from '#bifrost/Bifrost';
import type { EngineConnectionManager } from '#modules/engine-core';
import { extractEngineIdFromUri } from '#modules/engine-core';

import './engine-workspace.scss';
import initializeCommands from './initializers/initializeCommands';
import initializeDocumentTypes from './initializers/initializeDocumentTypes';
import initializeKeyBindings from './initializers/initializeKeyBindings';
import initializeMenus from './initializers/initializeMenus';
import initializePanes from './initializers/initializePanes';
import initializeRunMenu from './initializers/initializeRunMenu';
import { startTaskCountPoller } from './services/TaskCountPoller';

export async function onLoad(bifrost: Bifrost): Promise<void> {
  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');

  initializeDocumentTypes(bifrost);
  initializeCommands(bifrost, connectionManager);
  initializeMenus(bifrost, connectionManager);
  initializePanes(bifrost);
  initializeKeyBindings(bifrost);
  initializeRunMenu(bifrost, connectionManager);

  startTaskCountPoller(bifrost, connectionManager);

  connectionManager.on('engine:disconnected', (event: { engineId: string }) => {
    const openDocuments = bifrost.editors.getOpenEditorDocuments();
    for (const editorDocument of openDocuments) {
      const docEngineId = extractEngineIdFromUri(editorDocument.uri);
      if (docEngineId === event.engineId) {
        void bifrost.editors.closeEditorDocument(editorDocument);
      }
    }
  });

  connectionManager.on('engine:event', (event: any) => {
    const eventType = event?.type;
    if (eventType === 'EngineOverloaded') {
      const level = event.data?.level ?? 'unknown';
      connectionManager.setHealthOverride(event.engineId, level === 'critical' ? 'critical' : 'elevated');
      bifrost.notifications.open({
        type: level === 'critical' ? 'error' : 'warning',
        content: `Engine is overloaded (${level}). Active process instances: ${event.data?.activeProcessInstances ?? '?'}`,
        source: 'Engine',
      });
    } else if (eventType === 'EngineRecovered') {
      connectionManager.setHealthOverride(event.engineId, null);
      bifrost.notifications.open({
        type: 'info',
        content: 'Engine load has returned to normal.',
        source: 'Engine',
      });
    } else if (eventType === 'PluginQuarantined') {
      bifrost.notifications.open({
        type: 'warning',
        content: `Plugin "${event.data?.pluginName ?? 'unknown'}" was quarantined: ${event.data?.reason ?? 'unknown reason'}`,
        source: 'Engine',
      });
    }
  });
}
