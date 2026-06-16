import type { Bifrost } from '#bifrost/Bifrost';
import type { CanOpenDocumentResult } from '#bifrost/common/EditorDocumentTypeManager';

import type { EngineConnectionManager } from '../EngineConnectionManager';

const ENGINE_ID_URI_PATTERNS: RegExp[] = [
  /^engine:\/\/dashboard\/([^/?]+)/,
  /^engine:\/\/processes\/([^/?]+)/,
  /^engine:\/\/instances\/([^/?]+)/,
  /^engine-task-inbox:\/\/([^/?]+)/,
  /^engine:\/\/decisions\/([^/?]+)/,
  /^engine:\/\/timers\/([^/?]+)/,
  /^engine-model:\/\/([^/]+)\//,
  /^engine-decision:\/\/([^/]+)\//,
  /^engine-debug:\/\/([^/]+)\//,
  /^fragment\+engine-debug\.dmn-trace:\/\/([^/]+)\//,
];

export function extractEngineIdFromUri(uri: string): string | null {
  for (const pattern of ENGINE_ID_URI_PATTERNS) {
    const match = uri.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export function checkEngineConnectivity(bifrost: Bifrost, uri: string): CanOpenDocumentResult {
  const engineId = extractEngineIdFromUri(uri);
  if (!engineId) {
    return { documentCanBeOpened: false, error: 'Cannot determine engine ID from URI' };
  }

  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  if (connectionManager.isConnected(engineId)) {
    return { documentCanBeOpened: true };
  }

  return {
    documentCanBeOpened: false,
    error: 'Engine is not connected',
  };
}
