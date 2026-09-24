import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { SettingsMediator } from '#bifrost/common/SettingsMediator';
import { validateSetting } from '#bifrost/common/SettingsValidator';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';
import type { SettingsScopeTarget } from '#bifrost/contracts/SettingsScopeTypes';
import { EVENT_SETTINGS_CHANGED } from '#bifrost/contracts/internal/SettingsEvents';
import * as jsonComment from 'comment-json';

import type { SettingDescriptor, SettingValidationError, SettingsValidationResult } from '@elraptorus/bfw_studio_sdk';

import {
  EVENT_SETTINGS_RECEIVED_UPDATE,
  EVENT_SETTINGS_SAVE_VALIDATED,
  INVALID_JSON_VALIDATION_RESULT,
} from './UserSettingsDocumentModel';
import { buildJsonSchema } from './validation/schemaToJsonSchema';

type LayerScopeTarget = Exclude<SettingsScopeTarget, { scope: 'user' }>;

export function parseSettingsScopeUri(uri: string): SettingsScopeTarget | null {
  const query = uri.split('?')[1];
  if (query == null) {
    return null;
  }
  const parameters = new URLSearchParams(query);
  const scope = parameters.get('scope');
  if (scope === 'solution') {
    return { scope: 'solution' };
  }
  if (scope === 'project') {
    const projectBaseUri = parameters.get('project');
    if (projectBaseUri != null && projectBaseUri !== '') {
      return { scope: 'project', projectBaseUri };
    }
  }
  if (scope === 'user') {
    return { scope: 'user' };
  }
  return null;
}

export function settingsJsonUriForTarget(target: SettingsScopeTarget): string {
  if (target.scope === 'solution') {
    return 'about:settings-json?scope=solution';
  }
  if (target.scope === 'project') {
    return `about:settings-json?scope=project&project=${encodeURIComponent(target.projectBaseUri)}`;
  }
  return 'about:settings-json';
}

export function ineligibleSettingMessage(scope: LayerScopeTarget['scope']): string {
  return `Not eligible for ${scope} scope. This entry is ignored and blocks saving.`;
}

export default class ScopedSettingsDocumentModel extends EditorDocumentModel {
  private subscriptions: AbstractSubscription[] = [];
  private settings: SettingsMediator;
  private target: LayerScopeTarget;
  private lastValidationResult: SettingsValidationResult | null = null;

  private constructor(uri: string, settings: SettingsMediator, target: LayerScopeTarget) {
    super(uri);
    this.settings = settings;
    this.target = target;
    this.updateOriginalAndCurrentData('{}\n', '{}\n');

    this.subscriptions = [
      settings.on(
        EVENT_SETTINGS_CHANGED,
        (_key: string, _value: unknown, _added: unknown, changedTarget?: SettingsScopeTarget) => {
          if (changedTarget == null || !sameScopeTarget(changedTarget, this.target)) {
            return;
          }
          void this.reloadFromStore();
        },
      ),
    ];
  }

  static async create(
    uri: string,
    _restoredCurrentData: unknown,
    _restoredMetadata: unknown,
    _fileLoader: ILoadable,
    bifrost: Bifrost,
  ): Promise<ScopedSettingsDocumentModel> {
    const target = parseSettingsScopeUri(uri);
    if (target == null || target.scope === 'user') {
      throw new Error(`Unsupported settings JSON uri: ${uri}`);
    }
    const model = new ScopedSettingsDocumentModel(uri, bifrost.settings, target);
    await model.reloadFromStore();
    return model;
  }

  getScopeTarget(): SettingsScopeTarget {
    return this.target;
  }

  getJsonSchema(): ReturnType<typeof buildJsonSchema> {
    const descriptors = new Map<string, SettingDescriptor>();
    for (const [key, descriptor] of this.settings.getSchemas()) {
      descriptors.set(
        key,
        this.settings.isEligibleForScope(key, this.target.scope)
          ? descriptor
          : { ...descriptor, deprecated: ineligibleSettingMessage(this.target.scope) },
      );
    }
    return buildJsonSchema(descriptors);
  }

  getSettingsAsString(): string {
    return this.getCurrentData();
  }

  updateSettingsAsString(text: string): void {
    this.updateCurrentData(text);
  }

  isInvalidJSON(): boolean {
    try {
      jsonComment.parse(this.getSettingsAsString());
      return false;
    } catch {
      return true;
    }
  }

  getLastValidationResult(): SettingsValidationResult | null {
    return this.lastValidationResult;
  }

  async saveEditorDocument(): Promise<boolean> {
    if (this.isInvalidJSON()) {
      return this.finishSave(INVALID_JSON_VALIDATION_RESULT);
    }

    const currentData = this.getSettingsAsString();
    const parsed = jsonComment.parse(currentData);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return this.finishSave({
        valid: false,
        errors: [
          { key: '', message: 'Settings layer must be a JSON object.', expected: 'object', actual: typeof parsed },
        ],
      });
    }

    const errors: SettingValidationError[] = [];
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const descriptor = this.settings.getSchema(key);
      if (descriptor == null) {
        continue;
      }
      if (!this.settings.isEligibleForScope(key, this.target.scope)) {
        errors.push({
          key,
          message: ineligibleSettingMessage(this.target.scope),
          expected: this.target.scope,
          actual: descriptor.scope ?? 'application',
        });
        continue;
      }
      errors.push(...validateSetting(key, value, descriptor));
    }

    if (errors.length > 0) {
      return this.finishSave({ valid: false, errors });
    }

    try {
      await this.settings.writeScopeText(this.target, currentData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The settings target is no longer available.';
      return this.finishSave({ valid: false, errors: [{ key: '', message, expected: 'scope', actual: 'missing' }] });
    }

    this.updateOriginalAndCurrentData(currentData, currentData);
    return this.finishSave({ valid: true, errors: [] });
  }

  onEditorDocumentWillClose(): void {
    this.eventEmitter.removeAllListeners();
    this.subscriptions.forEach((subscription) => subscription.dispose());
  }

  private finishSave(result: SettingsValidationResult): boolean {
    this.lastValidationResult = result;
    this.emit(EVENT_SETTINGS_SAVE_VALIDATED, [result]);
    return result.valid;
  }

  private async reloadFromStore(): Promise<void> {
    try {
      const text = await this.settings.readScopeText(this.target);
      if (this.getSettingsAsString() !== text) {
        this.updateOriginalAndCurrentData(text, text);
        this.emit(EVENT_SETTINGS_RECEIVED_UPDATE);
      }
    } catch (error) {
      console.warn('Failed to reload scoped settings', error);
    }
  }
}

function sameScopeTarget(left: SettingsScopeTarget, right: SettingsScopeTarget): boolean {
  if (left.scope !== right.scope) {
    return false;
  }
  if (left.scope === 'project' && right.scope === 'project') {
    return left.projectBaseUri === right.projectBaseUri;
  }
  return true;
}
