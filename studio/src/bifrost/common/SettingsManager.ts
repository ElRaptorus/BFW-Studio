import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import {
  EVENT_SETTINGS_CHANGED,
  EVENT_SETTINGS_MERGED,
  EVENT_SETTINGS_SCHEMA_REGISTERED,
} from '#bifrost/contracts/internal/SettingsEvents';
import * as jsonComment from 'comment-json';
import equal from 'fast-deep-equal';

import type { SettingDescriptor, SettingsValidationResult } from '@elraptorus/bfw_studio_sdk';

import type { ISerializable, SerializedData } from '../contracts/SerializableTypes';
import { validateSetting, validateSettings } from './SettingsValidator';

export class SettingsManager extends AbstractEmitter implements ISerializable {
  private config: any = {};
  private schemaRegistry: Map<string, SettingDescriptor> = new Map();

  constructor(initialConfig: any) {
    super();
    this.config = initialConfig;
  }

  register(descriptors: Record<string, SettingDescriptor>): void {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      this.schemaRegistry.set(key, descriptor);
    }
    this.emit(EVENT_SETTINGS_SCHEMA_REGISTERED);
  }

  unregisterSettings(keys: string[]): void {
    for (const key of keys) {
      this.schemaRegistry.delete(key);
    }
    this.emit(EVENT_SETTINGS_SCHEMA_REGISTERED);
  }

  getSchema(key: string): SettingDescriptor | undefined {
    return this.schemaRegistry.get(key);
  }

  getSchemas(): Map<string, SettingDescriptor> {
    return new Map(this.schemaRegistry);
  }

  has(key: string): boolean {
    if (this.config[key] !== undefined) {
      return true;
    }
    return this.schemaRegistry.has(key);
  }

  set(key: string, value: any): void {
    if (equal(this.config[key], value)) {
      return;
    }

    const descriptor = this.schemaRegistry.get(key);
    if (descriptor != null) {
      const errors = validateSetting(key, value, descriptor);
      if (errors.length > 0) {
        console.warn(`[Settings] Rejected invalid value for "${key}":`, errors.map((e) => e.message).join('; '));
        return;
      }
    }

    this.config[key] = value;
    this.emit(EVENT_SETTINGS_CHANGED, [key, value]);
  }

  get(key: string): any {
    let configValue = this.config[key];
    if (configValue === undefined) {
      const descriptor = this.schemaRegistry.get(key);
      if (descriptor == null) {
        throw new Error(`Could not find a config with this key: ${key}`);
      }
      configValue = descriptor.default;
    }

    return defensiveCopy(configValue);
  }

  add(key: string, value: any): any {
    if (this.config[key] === undefined) {
      const descriptor = this.schemaRegistry.get(key);
      this.config[key] = descriptor != null ? defensiveCopy(descriptor.default) : {};
    }

    if (Array.isArray(this.config[key])) {
      this.config[key].push(value);
    } else {
      this.config[key] = {
        ...this.config[key],
        ...value,
      };
    }

    this.emit(EVENT_SETTINGS_CHANGED, [key, this.config[key], value]);
  }

  removeValue(key: string, value: string): void {
    if (!this.config[key]) {
      return;
    }

    if (Array.isArray(this.config[key])) {
      const index = this.config[key].findIndex((item) => item === value);
      if (index === -1) {
        return;
      }
      this.config[key].splice(index, 1);
    } else {
      delete this.config[key][value];
    }

    this.emit(EVENT_SETTINGS_CHANGED, [key, this.config[key], value]);
  }

  getDefault(key: string): any {
    const descriptor = this.schemaRegistry.get(key);
    if (descriptor == null) {
      throw new Error(`Could not find a config with this key: ${key}`);
    }
    return defensiveCopy(descriptor.default);
  }

  getDefaults(): any {
    const result: Record<string, unknown> = {};
    for (const [key, descriptor] of this.schemaRegistry) {
      result[key] = descriptor.default;
    }
    return result;
  }

  resetToDefault(): void {
    const deepCopy = jsonComment.parse(jsonComment.stringify(this.config, null, 2));
    this.config = {};

    const entries = Object.entries(deepCopy as any).map((entry) => {
      entry[1] = null;
      return entry;
    });
    this.publishSettingsChangedEventForEntries(entries);
  }

  delete(key: string): void {
    if (this.config[key] === undefined && !this.schemaRegistry.has(key)) {
      return;
    }

    delete this.config[key];
    this.schemaRegistry.delete(key);

    this.emit(EVENT_SETTINGS_CHANGED, [key, undefined]);
  }

  deserialize(dump: SerializedData): SettingsValidationResult {
    if (dump == null) {
      return { valid: true, errors: [] };
    }

    if (jsonComment.stringify(this.config, null, 2) === jsonComment.stringify(dump, null, 2)) {
      return { valid: true, errors: [] };
    }

    const validationResult = validateSettings(dump, this.schemaRegistry);
    if (!validationResult.valid) {
      return validationResult;
    }

    const changedOrNewEntries: any[] = [];

    Reflect.ownKeys(dump).forEach((dumpKey) => {
      const valueHasChanged =
        typeof dumpKey === 'symbol'
          ? !equal(this.config[dumpKey]?.valueOf(), dump[dumpKey]?.valueOf())
          : !equal(this.config[dumpKey], dump[dumpKey]);

      if (valueHasChanged) {
        changedOrNewEntries.push([dumpKey, dump[dumpKey]]);
      }
    });

    const deletedEntries: any[] = [];

    Reflect.ownKeys(this.config).forEach((configKey) => {
      if (!Reflect.has(dump, configKey)) {
        deletedEntries.push([configKey, undefined]);
      }
    });

    this.config = jsonComment.assign({}, dump, Object.keys(dump));

    this.emit(EVENT_SETTINGS_MERGED);
    this.publishSettingsChangedEventForEntries([...changedOrNewEntries, ...deletedEntries]);

    return { valid: true, errors: [] };
  }

  serialize(): SerializedData {
    return this.config;
  }

  private publishSettingsChangedEventForEntries(arrayWithChangedEntries: any[]): void {
    arrayWithChangedEntries.forEach((change) => {
      const key = change[0];
      const value = change[1];
      this.emit(EVENT_SETTINGS_CHANGED, [key, value]);
    });
  }
}

function defensiveCopy(value: unknown): any {
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return [...value];
    }
    return { ...value };
  }
  return value;
}
