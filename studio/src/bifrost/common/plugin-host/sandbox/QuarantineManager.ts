import * as fs from 'fs/promises';
import * as path from 'path';

interface QuarantineEntry {
  pluginName: string;
  crashCount: number;
  lastCrashAt: number;
  quarantinedAt?: number;
  reason?: string;
}

export interface QuarantineConfig {
  maxCrashes: number;
  windowMs: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: QuarantineConfig = {
  maxCrashes: 3,
  windowMs: 60_000,
  enabled: true,
};

export class QuarantineManager {
  private entries = new Map<string, QuarantineEntry>();
  private persistPath: string;
  private config: QuarantineConfig;

  constructor(storagePath: string, config?: Partial<QuarantineConfig>) {
    this.persistPath = path.join(storagePath, 'quarantine.json');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  recordCrash(pluginName: string, exitCode: number, reason?: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const now = Date.now();
    let entry = this.entries.get(pluginName);

    if (entry == null) {
      entry = { pluginName, crashCount: 0, lastCrashAt: 0 };
      this.entries.set(pluginName, entry);
    }

    // Reset crash count if outside the time window
    if (now - entry.lastCrashAt > this.config.windowMs) {
      entry.crashCount = 0;
    }

    entry.crashCount++;
    entry.lastCrashAt = now;
    entry.reason = reason ?? `exit code ${exitCode}`;

    if (entry.crashCount >= this.config.maxCrashes) {
      entry.quarantinedAt = now;
      this.save().catch((err) => console.error('[QuarantineManager] Failed to persist:', err));
      return true;
    }

    return false;
  }

  isQuarantined(pluginName: string): boolean {
    const entry = this.entries.get(pluginName);
    return entry?.quarantinedAt != null;
  }

  trustAndReEnable(pluginName: string): void {
    this.entries.delete(pluginName);
    this.save().catch((err) => console.error('[QuarantineManager] Failed to persist:', err));
  }

  getQuarantinedPlugins(): QuarantineEntry[] {
    return [...this.entries.values()].filter((e) => e.quarantinedAt != null);
  }

  getCrashCount(pluginName: string): number {
    return this.entries.get(pluginName)?.crashCount ?? 0;
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const parsed = JSON.parse(data) as QuarantineEntry[];
      this.entries.clear();
      for (const entry of parsed) {
        this.entries.set(entry.pluginName, entry);
      }
    } catch {
      // No persisted data or invalid format — start fresh
    }
  }

  async save(): Promise<void> {
    const quarantined = this.getQuarantinedPlugins();
    try {
      await fs.mkdir(path.dirname(this.persistPath), { recursive: true });
      await fs.writeFile(this.persistPath, JSON.stringify(quarantined, null, 2), 'utf-8');
    } catch (err) {
      console.error('[QuarantineManager] Failed to save:', err);
    }
  }
}
