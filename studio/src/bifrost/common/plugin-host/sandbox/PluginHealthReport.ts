export interface PluginHealthReport {
  pluginName: string;
  state: 'running' | 'crashed' | 'quarantined' | 'stopped';
  crashCount: number;
  totalCrashes: number;
  activationTimeMs: number;
  uptimeMs: number;
  workerThreadId?: number;
}
