import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { SettingsMediator } from '#bifrost/common/SettingsMediator';
import { validateSettings } from '#bifrost/common/SettingsValidator';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';
import { EVENT_SETTINGS_CHANGED } from '#bifrost/contracts/internal/SettingsEvents';
import type { JsonAssistBackend } from '#components/code-editor/jsonAssist';
import * as jsonComment from 'comment-json';

import type { SettingsValidationResult } from '@elraptorus/bfw_studio_sdk';

import { createSettingsJsonAssist } from './validation/settingsJsonAssist';

export const EVENT_SETTINGS_RECEIVED_UPDATE = 'EVENT_SETTINGS_RECEIVED_UPDATE';
/** Emitted with a `SettingsValidationResult` after every save attempt of a settings JSON document. */
export const EVENT_SETTINGS_SAVE_VALIDATED = 'EVENT_SETTINGS_SAVE_VALIDATED';

export const INVALID_JSON_VALIDATION_RESULT: SettingsValidationResult = {
  valid: false,
  errors: [{ key: '', message: 'Please provide valid JSON.', expected: 'JSON', actual: 'invalid' }],
};

export default class UserSettingsDocumentModel extends EditorDocumentModel {
  private subscriptions: AbstractSubscription[] = [];
  private settings: SettingsMediator;

  private constructor(uri: string, settings: SettingsMediator, restoredCurrentData: string | null = null) {
    super(uri);

    this.settings = settings;

    const settingsAsString = jsonComment.stringify(this.settings.UNSAFE_getSerializedData(), null, 2);
    this.updateOriginalAndCurrentData(settingsAsString, restoredCurrentData || settingsAsString);

    this.subscriptions = [
      settings.on(EVENT_SETTINGS_CHANGED, () => {
        const settingsAsString = jsonComment.stringify(this.settings.UNSAFE_getSerializedData(), null, 2);
        if (this.getSettingsAsString() !== settingsAsString) {
          this.updateSettingsAsString(settingsAsString);
          this.emit(EVENT_SETTINGS_RECEIVED_UPDATE);
        }
      }),
    ];
  }

  static async create(
    uri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    bifrost: Bifrost,
  ): Promise<UserSettingsDocumentModel> {
    return new UserSettingsDocumentModel(uri, bifrost.settings, restoredCurrentData);
  }

  getJsonAssist(): JsonAssistBackend {
    return createSettingsJsonAssist(this.settings.getSchemas(), {
      validateLayer: (layer) => validateSettings(layer, this.settings.getSchemas()).errors,
      isKeyOffered: () => true,
    });
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

  private lastValidationResult: SettingsValidationResult | null = null;

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
    const result = this.settings.merge(parsed);
    if (result.valid) {
      this.updateOriginalAndCurrentData(currentData, currentData);
    }
    return this.finishSave(result);
  }

  private finishSave(result: SettingsValidationResult): boolean {
    this.lastValidationResult = result;
    this.emit(EVENT_SETTINGS_SAVE_VALIDATED, [result]);
    return result.valid;
  }

  resetToDefault(): void {
    this.settings.resetToDefault();
  }

  onEditorDocumentWillClose(): void {
    this.eventEmitter.removeAllListeners();
    this.subscriptions.forEach((subscription: AbstractSubscription) => subscription.dispose());
  }
}
