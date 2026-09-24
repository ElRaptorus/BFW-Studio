import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type { FileEventType, FileHandlingService, WatcherDisposable } from '#bifrost/common/FileHandlingService';
import {
  SolutionFileUnreadableError,
  readSolutionSettings,
  readSolutionSettingsText,
  updateSolutionSettings,
} from '#bifrost/common/SolutionFile';
import { EVENT_SOLUTION_CHANGED } from '#bifrost/common/SolutionManager';
import type { SettingsScopeTarget } from '#bifrost/contracts/SettingsScopeTypes';
import type { Project, Solution } from '#bifrost/contracts/SolutionTypes';
import * as jsonComment from 'comment-json';
import equal from 'fast-deep-equal';

/** Private to the layer manager and SettingsMediator. Not a public bifrost event. */
export const EVENT_SETTINGS_LAYER_CHANGED = 'EVENT_SETTINGS_LAYER_CHANGED';

type SolutionEvents = {
  on(eventName: string, listener: () => void): { dispose: () => void };
};

/**
 * Owns the solution settings block and each project's `.bifrostfw/settings.json`.
 * User settings stay in `SettingsManager`.
 */
export class SettingsLayerManager extends AbstractEmitter {
  private solutionLayer: Record<string, unknown> | undefined;
  private projectLayers: Map<string, Record<string, unknown>> = new Map();
  private solutionWatcher: WatcherDisposable | null = null;
  private projectWatchers: Map<string, WatcherDisposable> = new Map();
  private signature = '';
  private reconcileGeneration = 0;

  constructor(
    private readonly fileHandling: FileHandlingService,
    private readonly readSolution: () => Solution | null,
  ) {
    super();
  }

  attachTo(solutionEvents: SolutionEvents): Promise<void> {
    solutionEvents.on(EVENT_SOLUTION_CHANGED, () => {
      void this.reconcile();
    });
    return this.reconcile();
  }

  getProjects(): readonly Project[] {
    return this.readSolution()?.projects ?? [];
  }

  hasSolutionFile(): boolean {
    return this.readSolution()?.solutionFileUri != null;
  }

  getSolutionLayer(): Readonly<Record<string, unknown>> | undefined {
    return this.solutionLayer;
  }

  getProjectLayers(): ReadonlyMap<string, Readonly<Record<string, unknown>>> {
    return this.projectLayers;
  }

  readLayer(target: SettingsScopeTarget): Record<string, unknown> {
    if (target.scope === 'solution') {
      return { ...(this.solutionLayer ?? {}) };
    }
    if (target.scope === 'project') {
      return { ...(this.projectLayers.get(target.projectBaseUri) ?? {}) };
    }
    return {};
  }

  async readRawText(target: SettingsScopeTarget): Promise<string> {
    this.assertTargetExists(target);
    if (target.scope === 'solution') {
      const solutionFileUri = this.readSolution()?.solutionFileUri as string;
      return readSolutionSettingsText(solutionFileUri, this.fileHandling);
    }
    if (target.scope === 'project') {
      const fileUri = projectSettingsFileUri(target.projectBaseUri);
      try {
        return await this.fileHandling.load(fileUri);
      } catch {
        return '{}\n';
      }
    }
    throw new Error('User settings are not stored in a layer file.');
  }

  async writeRawText(target: SettingsScopeTarget, text: string): Promise<void> {
    this.assertTargetExists(target);
    const parsed = jsonComment.parse(text);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Settings layer must be a JSON object.');
    }
    const nextLayer = toPlainRecord(parsed);

    if (target.scope === 'solution') {
      const solutionFileUri = this.requireSolutionFileUri();
      await updateSolutionSettings(solutionFileUri, this.fileHandling, () => parsed as Record<string, unknown>);
      const previous = this.solutionLayer ?? {};
      this.solutionLayer = nextLayer;
      this.publishLayer('solution', undefined, previous, nextLayer);
      return;
    }

    if (target.scope === 'project') {
      const { directoryUri, fileUri } = projectSettingsLocation(target.projectBaseUri);
      await this.fileHandling.createDirectory(directoryUri);
      await this.fileHandling.save(fileUri, ensureTrailingNewline(text));
      const previous = this.projectLayers.get(target.projectBaseUri) ?? {};
      this.projectLayers.set(target.projectBaseUri, nextLayer);
      this.publishLayer('project', target.projectBaseUri, previous, nextLayer);
      await this.armProjectWatcher(target.projectBaseUri);
    }
  }

  async writeSetting(
    target: Exclude<SettingsScopeTarget, { scope: 'user' }>,
    key: string,
    value: unknown,
  ): Promise<void> {
    await this.mutateLayer(target, (layer) => {
      layer[key] = value;
    });
  }

  async removeSetting(target: Exclude<SettingsScopeTarget, { scope: 'user' }>, key: string): Promise<void> {
    await this.mutateLayer(target, (layer) => {
      delete layer[key];
    });
  }

  async reconcile(): Promise<void> {
    const solution = this.readSolution();
    const signature = solutionSignature(solution);
    if (signature === this.signature) {
      return;
    }
    this.signature = signature;
    const generation = ++this.reconcileGeneration;

    const nextSolutionFileUri = solution?.solutionFileUri;
    const nextProjectBaseUris = new Set((solution?.projects ?? []).map((project) => project.baseUri));

    if (nextSolutionFileUri == null) {
      this.disposeSolutionWatcher();
      if (this.solutionLayer !== undefined) {
        this.publishLayer('solution', undefined, this.solutionLayer, {});
        this.solutionLayer = undefined;
      }
    }

    for (const projectBaseUri of [...this.projectLayers.keys()]) {
      if (!nextProjectBaseUris.has(projectBaseUri)) {
        this.disposeProjectWatcher(projectBaseUri);
        const previous = this.projectLayers.get(projectBaseUri) ?? {};
        this.projectLayers.delete(projectBaseUri);
        const affectedKeys = new Set([...Object.keys(previous), ...Object.keys(this.solutionLayer ?? {})]);
        for (const key of affectedKeys) {
          this.emit(EVENT_SETTINGS_LAYER_CHANGED, [key, { scope: 'project', projectBaseUri }]);
        }
      }
    }

    if (generation !== this.reconcileGeneration) {
      return;
    }

    if (nextSolutionFileUri != null) {
      const loaded = await this.loadSolutionSettings(nextSolutionFileUri);
      if (generation !== this.reconcileGeneration) {
        return;
      }
      const previous = this.solutionLayer ?? {};
      this.solutionLayer = loaded;
      this.publishLayer('solution', undefined, previous, loaded);
      this.watchSolutionFile(nextSolutionFileUri);
    }

    for (const projectBaseUri of nextProjectBaseUris) {
      if (generation !== this.reconcileGeneration) {
        return;
      }
      if (this.projectLayers.has(projectBaseUri)) {
        continue;
      }
      const fileUri = projectSettingsFileUri(projectBaseUri);
      const loaded = await this.loadObject(fileUri, (parsed) => (isRecord(parsed) ? parsed : {}));
      if (generation !== this.reconcileGeneration) {
        return;
      }
      const previous = this.projectLayers.get(projectBaseUri) ?? {};
      this.projectLayers.set(projectBaseUri, loaded);
      this.publishLayer('project', projectBaseUri, previous, loaded);
      await this.armProjectWatcher(projectBaseUri);
    }
  }

  private async mutateLayer(
    target: Exclude<SettingsScopeTarget, { scope: 'user' }>,
    mutate: (layer: Record<string, unknown>) => void,
  ): Promise<void> {
    this.assertTargetExists(target);

    if (target.scope === 'solution') {
      const solutionFileUri = this.requireSolutionFileUri();
      let nextLayer: Record<string, unknown> = {};
      await updateSolutionSettings(solutionFileUri, this.fileHandling, (settings) => {
        mutate(settings);
        nextLayer = toPlainRecord(settings);
      });
      const previous = this.solutionLayer ?? {};
      this.solutionLayer = nextLayer;
      this.publishLayer('solution', undefined, previous, nextLayer);
      return;
    }

    const { directoryUri, fileUri } = projectSettingsLocation(target.projectBaseUri);
    await this.fileHandling.createDirectory(directoryUri);
    const current = toPlainRecord(await this.readProjectDocument(fileUri));
    mutate(current);
    await this.fileHandling.save(fileUri, `${jsonComment.stringify(current, null, 2)}\n`);
    const previous = this.projectLayers.get(target.projectBaseUri) ?? {};
    this.projectLayers.set(target.projectBaseUri, current);
    this.publishLayer('project', target.projectBaseUri, previous, current);
    await this.armProjectWatcher(target.projectBaseUri);
  }

  private requireSolutionFileUri(): string {
    const solutionFileUri = this.readSolution()?.solutionFileUri;
    if (solutionFileUri == null) {
      throw new Error('No solution file is open.');
    }
    return solutionFileUri;
  }

  private async loadSolutionSettings(solutionFileUri: string): Promise<Record<string, unknown>> {
    try {
      return toPlainRecord(await readSolutionSettings(solutionFileUri, this.fileHandling));
    } catch (error) {
      if (error instanceof SolutionFileUnreadableError) {
        console.warn(`Ignoring unreadable solution file ${solutionFileUri}`, error);
        return {};
      }
      throw error;
    }
  }

  private async readProjectDocument(fileUri: string): Promise<Record<string, unknown>> {
    try {
      const raw = await this.fileHandling.load(fileUri);
      const parsed = jsonComment.parse(raw);
      if (!isRecord(parsed)) {
        throw new Error(`Project settings file is not a JSON object: ${fileUri}`);
      }
      return parsed;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Project settings file is not a JSON object')) {
        throw error;
      }
      return {};
    }
  }

  private async loadObject(
    fileUri: string,
    select: (parsed: unknown) => Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    let raw: string;
    try {
      raw = await this.fileHandling.load(fileUri);
    } catch {
      return {};
    }
    try {
      return toPlainRecord(select(jsonComment.parse(raw)));
    } catch (error) {
      console.warn(`Ignoring unparsable settings file ${fileUri}`, error);
      return {};
    }
  }

  private watchSolutionFile(solutionFileUri: string): void {
    this.disposeSolutionWatcher();
    this.solutionWatcher = this.tryWatch(solutionFileUri, () => {
      void this.reloadSolution(solutionFileUri);
    });
  }

  /**
   * chokidar cannot observe a file whose parent directory does not exist yet, so a project
   * without `.bifrostfw/` is watched shallowly until that directory appears.
   */
  private async armProjectWatcher(projectBaseUri: string): Promise<void> {
    this.disposeProjectWatcher(projectBaseUri);
    const { directoryUri, fileUri } = projectSettingsLocation(projectBaseUri);

    const directoryExists = await this.fileHandling
      .doesFileOrDirectoryExist(this.fileHandling.getLocalFilenameForUri(directoryUri))
      .catch(() => false);
    if (!this.getProjects().some((project) => project.baseUri === projectBaseUri)) {
      return;
    }
    // A concurrent arm may have finished while awaiting; never leave two watchers alive.
    this.disposeProjectWatcher(projectBaseUri);

    const watcher = directoryExists
      ? this.tryWatch(fileUri, () => {
          void this.reloadProject(projectBaseUri, fileUri);
        })
      : this.tryWatch(
          projectBaseUri,
          (eventType, filePath) => {
            if (eventType === 'addDir' && filePath.replace(/[/\\]+$/, '').endsWith('.bifrostfw')) {
              void this.armProjectWatcher(projectBaseUri).then(() => this.reloadProject(projectBaseUri, fileUri));
            }
          },
          { depth: 0 },
        );
    if (watcher != null) {
      this.projectWatchers.set(projectBaseUri, watcher);
    }
  }

  private disposeProjectWatcher(projectBaseUri: string): void {
    this.projectWatchers.get(projectBaseUri)?.dispose();
    this.projectWatchers.delete(projectBaseUri);
  }

  private async reloadSolution(solutionFileUri: string): Promise<void> {
    if (this.readSolution()?.solutionFileUri !== solutionFileUri) {
      return;
    }
    const loaded = await this.loadSolutionSettings(solutionFileUri);
    const previous = this.solutionLayer ?? {};
    this.solutionLayer = loaded;
    this.publishLayer('solution', undefined, previous, loaded);
  }

  private async reloadProject(projectBaseUri: string, fileUri: string): Promise<void> {
    if (!this.getProjects().some((project) => project.baseUri === projectBaseUri)) {
      return;
    }
    const loaded = await this.loadObject(fileUri, (parsed) => (isRecord(parsed) ? parsed : {}));
    const previous = this.projectLayers.get(projectBaseUri) ?? {};
    this.projectLayers.set(projectBaseUri, loaded);
    this.publishLayer('project', projectBaseUri, previous, loaded);
  }

  private tryWatch(
    fileUri: string,
    onChange: (eventType: FileEventType, filePath: string) => void,
    options?: { depth?: number },
  ): WatcherDisposable | null {
    try {
      return this.fileHandling.watchFile(fileUri, (eventType, filePath) => onChange(eventType, filePath), options);
    } catch (error) {
      console.warn(`Settings file watch is unavailable for ${fileUri}`, error);
      return null;
    }
  }

  private disposeSolutionWatcher(): void {
    this.solutionWatcher?.dispose();
    this.solutionWatcher = null;
  }

  private publishLayer(
    scope: 'solution' | 'project',
    projectBaseUri: string | undefined,
    previous: Record<string, unknown>,
    next: Record<string, unknown>,
  ): void {
    const target: SettingsScopeTarget =
      scope === 'solution' ? { scope: 'solution' } : { scope: 'project', projectBaseUri: projectBaseUri ?? '' };
    for (const key of changedKeys(previous, next)) {
      this.emit(EVENT_SETTINGS_LAYER_CHANGED, [key, target]);
    }
  }

  private assertTargetExists(target: SettingsScopeTarget): void {
    if (target.scope === 'solution' && !this.hasSolutionFile()) {
      throw new Error('No solution file is open.');
    }
    if (
      target.scope === 'project' &&
      !this.getProjects().some((project) => project.baseUri === target.projectBaseUri)
    ) {
      throw new Error(`Project is not part of the open solution: ${target.projectBaseUri}`);
    }
  }
}

function solutionSignature(solution: Solution | null): string {
  if (solution == null) {
    return '';
  }
  const projectBaseUris = solution.projects
    .map((project) => project.baseUri)
    .sort()
    .join('\0');
  return `${solution.solutionFileUri ?? ''}|${projectBaseUris}`;
}

function projectSettingsLocation(projectBaseUri: string): { directoryUri: string; fileUri: string } {
  const base = projectBaseUri.endsWith('/') ? projectBaseUri.slice(0, -1) : projectBaseUri;
  const directoryUri = `${base}/.bifrostfw`;
  return { directoryUri, fileUri: `${directoryUri}/settings.json` };
}

function projectSettingsFileUri(projectBaseUri: string): string {
  return projectSettingsLocation(projectBaseUri).fileUri;
}

function changedKeys(previous: Record<string, unknown>, next: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  return [...keys].filter((key) => !equal(previous[key], next[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toPlainRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}
