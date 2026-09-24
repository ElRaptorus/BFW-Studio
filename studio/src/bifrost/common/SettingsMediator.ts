import { AbstractEmitter, type AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { EVENT_SETTINGS_LAYER_CHANGED, SettingsLayerManager } from '#bifrost/common/SettingsLayerManager';
import { SolutionFileUnreadableError } from '#bifrost/common/SolutionFile';
import type { SettingInspection, SettingsScopeTarget } from '#bifrost/contracts/SettingsScopeTypes';
import {
  EVENT_SETTINGS_CHANGED,
  EVENT_SETTINGS_MERGED,
  EVENT_SETTINGS_SCHEMA_REGISTERED,
} from '#bifrost/contracts/internal/SettingsEvents';
import equal from 'fast-deep-equal';

import type { SettingDescriptor, SettingScope, SettingsValidationResult } from '@elraptorus/bfw_studio_sdk';

import type { LocalStorageItem } from './LocalStorageItem';
import { SettingsManager } from './SettingsManager';
import { validateSetting } from './SettingsValidator';

export type SettingsResource = string | null | (() => string | null);

type ChangeSubscriber = {
  handler: (key: string) => void;
  uriSource: SettingsResource | undefined;
};

export type SettingsWorkspace = {
  fileHandling: ConstructorParameters<typeof SettingsLayerManager>[0];
  readSolution: ConstructorParameters<typeof SettingsLayerManager>[1];
  solutionEvents: { on(eventName: string, listener: () => void): { dispose: () => void } };
  readFocusedEditorDocument: () => { documentType: string; uri: string } | null;
  reportError: (message: string) => void;
  offerSolutionFileRepair: (error: SolutionFileUnreadableError) => Promise<boolean>;
};

/**
 * Settings are key/value pairs of information which determine Bifrost's behaviour in a customizable way.
 *
 * Settings are app-specific, not instance-specific. In practical terms, this means that settings are propagated
 * across windows in the Electron app.
 *
 * Every setting must be registered with a `SettingDescriptor` before it can be used.
 * The descriptor defines the setting's type, default value, label, description, and validation rules.
 */
export class SettingsMediator extends AbstractEmitter {
  private settingsManager: SettingsManager;
  private settingsStorage: LocalStorageItem;
  private layerManager: SettingsLayerManager | null = null;
  private reportError: (message: string) => void = (message) => console.warn(`[Settings] ${message}`);
  private readFocusedEditorDocument: (() => { documentType: string; uri: string } | null) | null = null;
  private offerSolutionFileRepair: (error: SolutionFileUnreadableError) => Promise<boolean> = async () => false;
  private changeSubscribers = new Set<ChangeSubscriber>();

  constructor(localStorage: LocalStorageItem) {
    super();

    this.settingsManager = new SettingsManager({});
    this.settingsStorage = localStorage;

    this.settingsManager.on(EVENT_SETTINGS_CHANGED, (name: string, currentValue: any, addedValue?: any) => {
      const settingsData = this.settingsManager.serialize();
      this.settingsStorage.save(settingsData);

      this.emit(EVENT_SETTINGS_CHANGED, [name, currentValue, addedValue]);
    });

    this.settingsManager.on(EVENT_SETTINGS_MERGED, (_name: string, _currentValue: any, _addedValue?: any) => {
      this.emit(EVENT_SETTINGS_MERGED);
    });

    this.settingsManager.on(EVENT_SETTINGS_SCHEMA_REGISTERED, () => {
      this.emit(EVENT_SETTINGS_SCHEMA_REGISTERED);
    });

    const settingsData = this.settingsStorage.load();
    this.settingsManager.deserialize(settingsData);
  }

  /**
   * Registers settings with their descriptors (type, default, label, description, validation).
   *
   * Each key in the `descriptors` object is a setting key, and the value is a `SettingDescriptor`
   * that defines the setting's type, default value, and metadata for the Settings GUI.
   *
   * Example:
   *
   * ```ts
   * studio.settings.register({
   *   'myPlugin.feature.enabled': {
   *     type: 'boolean',
   *     label: 'Enable Feature',
   *     description: 'Controls whether the feature is active.',
   *     default: true,
   *   },
   * });
   * ```
   */
  register(descriptors: Record<string, SettingDescriptor>): void {
    this.settingsManager.register(descriptors);
  }

  /**
   * Removes setting schemas for the given keys. The stored values are preserved
   * (the user's customization remains inert) — only the schema is removed so the
   * settings no longer appear in the Settings editor.
   */
  unregisterSettings(keys: string[]): void {
    this.settingsManager.unregisterSettings(keys);
  }

  /**
   * Returns the schema descriptor for the given setting key, or `undefined` if not registered.
   */
  getSchema(key: string): SettingDescriptor | undefined {
    return this.settingsManager.getSchema(key);
  }

  /**
   * Returns a copy of all registered setting descriptors.
   */
  getSchemas(): Map<string, SettingDescriptor> {
    return this.settingsManager.getSchemas();
  }

  /**
   * Checks if a setting with the given key exists.
   *
   * @param key The key to lookup.
   * @returns True, if the setting exists. False, if it does not.
   */
  has(key: string): boolean {
    return this.settingsManager.has(key);
  }

  /**
   * Sets the setting for the given `key`.
   *
   * Application keys are written to User. Scoped keys follow the write-target rule for the
   * resolved resource (see `get`). Resolves to `null` when the value is invalid or the write failed.
   */
  async set(key: string, value: unknown, resourceUri?: string | null): Promise<SettingsScopeTarget | null> {
    const descriptor = this.getSchema(key);
    if (descriptor == null || (descriptor.scope ?? 'application') === 'application') {
      const errors = descriptor == null ? [] : validateSetting(key, value, descriptor);
      if (errors.length > 0) {
        console.warn(
          `[Settings] Rejected invalid value for "${key}":`,
          errors.map((error) => error.message).join('; '),
        );
        return null;
      }
      this.settingsManager.set(key, value);
      return { scope: 'user' };
    }

    const context = this.contextFor(this.resolveResource(resourceUri));
    const target = determineWriteTarget(key, descriptor, this.layers(), context);
    const errors = validateSetting(key, value, descriptor);
    if (errors.length > 0) {
      this.reportError(`Invalid value for "${key}": ${errors.map((error) => error.message).join('; ')}`);
      return null;
    }
    if (target.scope === 'user' || this.layerManager == null) {
      this.settingsManager.set(key, value);
      return { scope: 'user' };
    }
    try {
      if (target.scope === 'solution') {
        const written = await this.withSolutionFileRepair(() => this.layerManager!.writeSetting(target, key, value));
        return written ? target : null;
      }
      await this.layerManager.writeSetting(target, key, value);
      return target;
    } catch (error) {
      const layerName = target.scope === 'solution' ? 'Solution' : 'Project';
      const reason = error instanceof Error ? error.message : String(error);
      this.reportError(`Could not save "${key}" to ${layerName} settings: ${reason}`);
      return null;
    }
  }

  /**
   * Adds the given `value` to the given `key`.
   *
   * For array settings, the value is pushed onto the array.
   * For object settings, the value is shallow-merged into the existing object.
   */
  add(key: string, config: any): void {
    this.settingsManager.add(key, config);
  }

  /**
   * Removes the given value from the given key.
   *
   * For array settings, removes the first matching element.
   * For object settings, deletes the property with that key.
   */
  removeValue(key: string, value: string): void {
    this.settingsManager.removeValue(key, value);
  }

  /**
   * Returns the current value for the given `key`.
   *
   * Application settings ignore `resourceUri`. Scoped settings resolve against the focused
   * editor document when `resourceUri` is omitted, against User when it is `null`, and against
   * the given resource otherwise.
   *
   * Throws if the key is not registered.
   */
  get(key: string, resourceUri?: string | null): any {
    const descriptor = this.getSchema(key);
    if (descriptor == null) {
      return this.settingsManager.get(key);
    }
    if ((descriptor.scope ?? 'application') === 'application') {
      return this.settingsManager.get(key);
    }
    return inspectScopedSetting(key, descriptor, this.layers(), this.contextFor(this.resolveResource(resourceUri)))
      .value;
  }

  /** Effective value and the layer that supplied it. Same resource rule as `get`. */
  inspect(key: string, resourceUri?: string | null): SettingInspection {
    return inspectScopedSetting(
      key,
      this.getSchema(key),
      this.layers(),
      this.contextFor(this.resolveResource(resourceUri)),
    );
  }

  /**
   * Returns the registered default value for the given `key`.
   * Throws if the key is not registered.
   */
  getDefault(key: string): any {
    return this.settingsManager.getDefault(key);
  }

  /**
   * Gets all registered default values as a flat key-value object.
   */
  getDefaults(): any {
    return this.settingsManager.getDefaults();
  }

  /**
   * Merges the given config object as the full set of user overrides.
   *
   * All entries are validated against their registered descriptors.
   * If validation fails, the merge is rejected and the result contains the errors.
   *
   * @param settingsAsObject The full config as object.
   * @returns The validation result. If `valid` is false, `errors` contains the details.
   */
  merge(settingsAsObject: object): SettingsValidationResult {
    return this.settingsManager.deserialize(settingsAsObject);
  }

  /**
   * Internal: Used by settings propagation across windows.
   */
  onSettingsChangedInOtherInstance(_name: string, _value: any): void {
    const settingsData = this.settingsStorage.load();
    this.settingsManager.deserialize(settingsData);
  }

  resetToDefault(): void {
    this.settingsManager.resetToDefault();
  }

  /**
   * Internal: Methods using the `UNSAFE_` prefix are, well, unsafe to use. Most of the time, they are exposing
   * the internal state of objects for inspection purposes.
   *
   * IMPORTANT: You must not build ANY logic upon this data!
   */
  UNSAFE_getSerializedData(): any {
    return this.settingsManager.serialize();
  }

  /**
   * Removes the setting with the given key.
   *
   * WARNING: Should only be used for migrating old settings.
   *
   * @param key The setting to remove.
   */
  UNSAFE_delete(key: string): void {
    return this.settingsManager.delete(key);
  }

  /**
   * Connects solution, project and focused-document context. Until this runs, scoped keys resolve as User.
   */
  attachWorkspace(workspace: SettingsWorkspace): Promise<void> {
    this.reportError = workspace.reportError;
    this.offerSolutionFileRepair = workspace.offerSolutionFileRepair;
    this.readFocusedEditorDocument = workspace.readFocusedEditorDocument;
    const layerManager = new SettingsLayerManager(workspace.fileHandling, workspace.readSolution);
    this.layerManager = layerManager;
    layerManager.on(
      EVENT_SETTINGS_LAYER_CHANGED,
      (key: string, target: Exclude<SettingsScopeTarget, { scope: 'user' }>) => {
        // Layer files may hold unregistered or application keys; those never resolve from a layer.
        if (!this.isEligibleForScope(key, 'solution')) {
          return;
        }
        this.emit(EVENT_SETTINGS_CHANGED, [key, this.get(key), undefined, target]);
        this.notifyLayerChange(key, target);
      },
    );
    return layerManager.attachTo(workspace.solutionEvents);
  }

  /**
   * Fires when a setting changes. Without a resource, every change is reported.
   * With a resource, only changes that affect that resource are reported.
   */
  onDidChange(handler: (key: string) => void, resourceUri?: SettingsResource): AbstractSubscription {
    const subscriber: ChangeSubscriber = { handler, uriSource: resourceUri };
    this.changeSubscribers.add(subscriber);
    const userSubscription = this.on(
      EVENT_SETTINGS_CHANGED,
      (key: string, _value: unknown, _added: unknown, scopeTarget?: SettingsScopeTarget) => {
        if (scopeTarget == null) {
          handler(key);
        }
      },
    );
    return {
      dispose: () => {
        this.changeSubscribers.delete(subscriber);
        userSubscription.dispose();
      },
    };
  }

  /** Notifies resource-bound subscribers whose resource moved and whose effective values differ. */
  resourceMoved(previousUri: string, currentUri: string): void {
    const layers = this.layers();
    for (const subscriber of this.changeSubscribers) {
      if (this.currentUri(subscriber) !== currentUri) {
        continue;
      }
      for (const [key, descriptor] of this.getSchemas()) {
        if ((descriptor.scope ?? 'application') === 'application') {
          continue;
        }
        const previous = inspectScopedSetting(key, descriptor, layers, this.contextFor(previousUri));
        const current = inspectScopedSetting(key, descriptor, layers, this.contextFor(currentUri));
        if (!equal(previous.value, current.value)) {
          subscriber.handler(key);
        }
      }
    }
  }

  isEligibleForScope(key: string, scope: 'user' | 'solution' | 'project'): boolean {
    return isEligible(this.getSchema(key), scope);
  }

  getProjectBaseUriForResource(resourceUri: string | null): string | null {
    return findProjectForResource(this.layerManager?.getProjects() ?? [], resourceUri)?.baseUri ?? null;
  }

  getAvailableScopeTargets(): SettingsScopeTarget[] {
    const targets: SettingsScopeTarget[] = [{ scope: 'user' }];
    const store = this.layerManager;
    if (store == null) {
      return targets;
    }
    if (store.hasSolutionFile()) {
      targets.push({ scope: 'solution' });
    }
    for (const project of store.getProjects()) {
      targets.push({ scope: 'project', projectBaseUri: project.baseUri });
    }
    return targets;
  }

  getScopeValues(target: SettingsScopeTarget): Record<string, unknown> {
    if (target.scope === 'user') {
      return { ...this.userLayer() };
    }
    return this.layerManager?.readLayer(target) ?? {};
  }

  /**
   * Writes `value` into the given layer. Resolves to `false` when the key is ineligible, the value
   * is invalid, or the write failed; the reason has already been reported.
   */
  async setInScope(target: SettingsScopeTarget, key: string, value: unknown): Promise<boolean> {
    return this.runScopeWrite(target, key, async () => {
      this.assertEligible(target, key);
      const descriptor = this.getSchema(key);
      if (descriptor != null) {
        const errors = validateSetting(key, value, descriptor);
        if (errors.length > 0) {
          throw new Error(`Invalid value: ${errors.map((error) => error.message).join('; ')}`);
        }
      }
      if (target.scope === 'user') {
        this.settingsManager.set(key, value);
        return;
      }
      await this.requireStore().writeSetting(target, key, value);
    });
  }

  /** Removes `key` from the given layer. Resolves to `false` on failure, which has been reported. */
  async removeFromScope(target: SettingsScopeTarget, key: string): Promise<boolean> {
    return this.runScopeWrite(target, key, async () => {
      this.assertEligible(target, key);
      if (target.scope === 'user') {
        this.settingsManager.clearOverride(key);
        return;
      }
      await this.requireStore().removeSetting(target, key);
    });
  }

  inspectForTarget(target: SettingsScopeTarget, key: string): SettingInspection {
    const store = this.layerManager;
    return inspectScopedSetting(
      key,
      this.getSchema(key),
      {
        user: this.userLayer(),
        solution: store?.hasSolutionFile() ? (store.getSolutionLayer() ?? {}) : undefined,
        projects: store?.getProjectLayers() ?? new Map(),
      },
      {
        resourceUri: null,
        projects: store?.getProjects() ?? [],
        scopeTarget: target,
      },
    );
  }

  async readScopeText(target: Exclude<SettingsScopeTarget, { scope: 'user' }>): Promise<string> {
    return this.requireStore().readRawText(target);
  }

  async writeScopeText(target: Exclude<SettingsScopeTarget, { scope: 'user' }>, text: string): Promise<void> {
    const write = () => this.requireStore().writeRawText(target, text);
    if (target.scope !== 'solution') {
      await write();
      return;
    }
    try {
      await write();
    } catch (error) {
      if (!(error instanceof SolutionFileUnreadableError)) {
        throw error;
      }
      if (!(await this.offerSolutionFileRepair(error))) {
        throw error;
      }
      await write();
    }
  }

  listOverridingScopes(key: string): SettingsScopeTarget[] {
    const store = this.layerManager;
    if (store == null) {
      return [];
    }
    const descriptor = this.getSchema(key);
    const targets: SettingsScopeTarget[] = [];
    const solutionLayer = store.getSolutionLayer();
    if (store.hasSolutionFile() && solutionLayer != null && Object.prototype.hasOwnProperty.call(solutionLayer, key)) {
      if (isEligible(descriptor, 'solution')) {
        targets.push({ scope: 'solution' });
      }
    }
    for (const project of store.getProjects()) {
      const layer = store.getProjectLayers().get(project.baseUri);
      if (layer != null && Object.prototype.hasOwnProperty.call(layer, key) && isEligible(descriptor, 'project')) {
        targets.push({ scope: 'project', projectBaseUri: project.baseUri });
      }
    }
    return targets;
  }

  private resolveResource(resourceUri?: string | null): string | null {
    if (resourceUri === undefined) {
      return this.readFocusedEditorDocument?.()?.uri ?? null;
    }
    return resourceUri;
  }

  private layers(): ScopedSettingLayers {
    const store = this.layerManager;
    return {
      user: this.userLayer(),
      solution: store?.hasSolutionFile() ? (store.getSolutionLayer() ?? {}) : undefined,
      projects: store?.getProjectLayers() ?? new Map(),
    };
  }

  private contextFor(resourceUri: string | null): ScopedSettingContext {
    return {
      resourceUri,
      projects: this.layerManager?.getProjects() ?? [],
    };
  }

  private notifyLayerChange(key: string, target: Exclude<SettingsScopeTarget, { scope: 'user' }>): void {
    for (const subscriber of this.changeSubscribers) {
      if (subscriber.uriSource === undefined) {
        subscriber.handler(key);
        continue;
      }
      if (this.targetAffects(this.currentUri(subscriber), target)) {
        subscriber.handler(key);
      }
    }
  }

  private currentUri(subscriber: ChangeSubscriber): string | null {
    const source = subscriber.uriSource;
    if (source === undefined || source === null) {
      return null;
    }
    return typeof source === 'function' ? source() : source;
  }

  private targetAffects(resourceUri: string | null, target: Exclude<SettingsScopeTarget, { scope: 'user' }>): boolean {
    if (target.scope === 'solution') {
      return findProjectForResource(this.layerManager?.getProjects() ?? [], resourceUri) != null;
    }
    return isResourceInsideBaseUri(resourceUri, target.projectBaseUri);
  }

  private async withSolutionFileRepair(write: () => Promise<void>): Promise<boolean> {
    try {
      await write();
      return true;
    } catch (error) {
      if (!(error instanceof SolutionFileUnreadableError)) {
        throw error;
      }
      if (!(await this.offerSolutionFileRepair(error))) {
        return false;
      }
      await write();
      return true;
    }
  }

  private async runScopeWrite(target: SettingsScopeTarget, key: string, write: () => Promise<void>): Promise<boolean> {
    try {
      if (target.scope === 'solution') {
        return await this.withSolutionFileRepair(write);
      }
      await write();
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.reportError(`Could not save "${key}": ${reason}`);
      return false;
    }
  }

  private userLayer(): Record<string, unknown> {
    const serialized = this.settingsManager.serialize();
    if (serialized == null || typeof serialized !== 'object') {
      return {};
    }
    return serialized as Record<string, unknown>;
  }

  private assertEligible(target: SettingsScopeTarget, key: string): void {
    if (target.scope === 'user') {
      return;
    }
    if (!isEligible(this.getSchema(key), target.scope)) {
      throw new Error(`Setting "${key}" is not eligible for ${target.scope} scope.`);
    }
  }

  private requireStore(): SettingsLayerManager {
    if (this.layerManager == null) {
      throw new Error('Scoped settings are not available.');
    }
    return this.layerManager;
  }
}

/** Layer maps consulted by resolution. `solution === undefined` means there is no solution file. */
type ScopedSettingLayers = {
  user: Readonly<Record<string, unknown>>;
  solution: Readonly<Record<string, unknown>> | undefined;
  projects: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
};

/**
 * Resource resolution uses the URI. A scope target forces the Settings GUI's
 * selected layer instead (solution effective value ignores project overrides).
 */
type ScopedSettingContext = {
  resourceUri: string | null;
  projects: readonly { baseUri: string }[];
  scopeTarget?: SettingsScopeTarget;
};

const absent = Symbol('absent');

function findProjectForResource<T extends { baseUri: string }>(
  projects: readonly T[],
  resourceUri: string | null,
): T | undefined {
  if (resourceUri == null || resourceUri.startsWith('buffer:')) {
    return undefined;
  }

  let match: T | undefined;
  for (const project of projects) {
    if (!isResourceInsideBaseUri(resourceUri, project.baseUri)) {
      continue;
    }
    if (match == null || normalizeResourceUri(project.baseUri).length > normalizeResourceUri(match.baseUri).length) {
      match = project;
    }
  }
  return match;
}

function isEligible(descriptor: { scope?: SettingScope } | undefined, scope: 'user' | 'solution' | 'project'): boolean {
  if (descriptor == null) {
    return false;
  }
  if (scope === 'user') {
    return true;
  }
  const settingScope = descriptor.scope ?? 'application';
  if (scope === 'solution') {
    return settingScope === 'solution' || settingScope === 'project';
  }
  return settingScope === 'project';
}

function inspectScopedSetting(
  key: string,
  descriptor: SettingDescriptor | undefined,
  layers: ScopedSettingLayers,
  context: ScopedSettingContext,
): SettingInspection {
  const projectBaseUri = resolveProjectBaseUri(context);
  const includeSolution = shouldIncludeSolutionLayer(layers, context, projectBaseUri);
  const includeProject =
    projectBaseUri != null && (context.scopeTarget == null || context.scopeTarget.scope === 'project');

  if (includeProject && projectBaseUri != null) {
    const projectValue = readLayerValue(key, descriptor, layers.projects.get(projectBaseUri), 'project');
    if (projectValue !== absent) {
      return { value: projectValue, definedIn: 'project' };
    }
  }

  if (includeSolution) {
    const solutionValue = readLayerValue(key, descriptor, layers.solution, 'solution');
    if (solutionValue !== absent) {
      return { value: solutionValue, definedIn: 'solution' };
    }
  }

  const userValue = readLayerValue(key, descriptor, layers.user, 'user');
  if (userValue !== absent) {
    return { value: userValue, definedIn: 'user' };
  }

  return { value: descriptor?.default, definedIn: 'default' };
}

function determineWriteTarget(
  key: string,
  descriptor: SettingDescriptor | undefined,
  layers: ScopedSettingLayers,
  context: ScopedSettingContext,
): SettingsScopeTarget {
  const project = findProjectForResource(context.projects, context.resourceUri);
  if (project != null) {
    const projectValue = readLayerValue(key, descriptor, layers.projects.get(project.baseUri), 'project');
    if (projectValue !== absent) {
      return { scope: 'project', projectBaseUri: project.baseUri };
    }
  }

  if (project != null && layers.solution !== undefined) {
    const solutionValue = readLayerValue(key, descriptor, layers.solution, 'solution');
    if (solutionValue !== absent) {
      return { scope: 'solution' };
    }
  }

  return { scope: 'user' };
}

function resolveProjectBaseUri(context: ScopedSettingContext): string | null {
  if (context.scopeTarget?.scope === 'user' || context.scopeTarget?.scope === 'solution') {
    return null;
  }
  if (context.scopeTarget?.scope === 'project') {
    return context.scopeTarget.projectBaseUri;
  }
  return findProjectForResource(context.projects, context.resourceUri)?.baseUri ?? null;
}

function shouldIncludeSolutionLayer(
  layers: ScopedSettingLayers,
  context: ScopedSettingContext,
  projectBaseUri: string | null,
): boolean {
  if (layers.solution === undefined) {
    return false;
  }
  if (context.scopeTarget?.scope === 'user') {
    return false;
  }
  if (context.scopeTarget?.scope === 'solution' || context.scopeTarget?.scope === 'project') {
    return true;
  }
  return projectBaseUri != null;
}

function readLayerValue(
  key: string,
  descriptor: SettingDescriptor | undefined,
  layer: Readonly<Record<string, unknown>> | undefined,
  scope: 'user' | 'solution' | 'project',
): unknown {
  if (layer == null || !Object.prototype.hasOwnProperty.call(layer, key)) {
    return absent;
  }
  if (!isEligible(descriptor, scope) || descriptor == null) {
    return absent;
  }
  if (validateSetting(key, layer[key], descriptor).length > 0) {
    return absent;
  }
  return layer[key];
}

function normalizeResourceUri(uri: string): string {
  let decoded: string;
  try {
    decoded = decodeURI(uri);
  } catch {
    decoded = uri;
  }
  return decoded.endsWith('/') ? decoded.slice(0, -1) : decoded;
}

function isResourceInsideBaseUri(resourceUri: string | null, baseUri: string): boolean {
  if (resourceUri == null || resourceUri.startsWith('buffer:')) {
    return false;
  }
  const normalizedResource = normalizeResourceUri(resourceUri);
  const normalizedBase = normalizeResourceUri(baseUri);
  return normalizedResource === normalizedBase || normalizedResource.startsWith(`${normalizedBase}/`);
}
