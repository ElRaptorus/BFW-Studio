import type { EngineConnectionManager } from '#modules/engine-core';

export function resolveAuthLabel(connectionManager: EngineConnectionManager, engineUrl: string): string {
  const subject = connectionManager.identity.getSubject(engineUrl);
  if (subject) {
    return subject.length > 20 ? subject.slice(0, 17) + '…' : subject;
  }
  return connectionManager.identity.hasToken(engineUrl) ? 'Token set' : 'No Token';
}
