import React, { useState } from 'react';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';

import { ColorControl } from './ColorControl';
import { DateControl } from './DateControl';
import { NumberControl } from './NumberControl';
import { StringControl } from './StringControl';

type ObjectArrayItemsControlProps = {
  properties: Record<string, SettingDescriptor>;
  value: unknown[];
  onChange: (value: unknown[]) => void;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function objectArrayItemKey(raw: unknown): string {
  if (isPlainObject(raw) && typeof raw.id === 'string' && raw.id !== '') {
    return raw.id;
  }
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

function defaultValueForField(descriptor: SettingDescriptor): unknown {
  if (descriptor.type === 'string' && descriptor.default === null) {
    return '';
  }
  return descriptor.default;
}

function buildDefaultItem(properties: Record<string, SettingDescriptor>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(properties)) {
    row[key] = defaultValueForField(properties[key]!);
  }
  return row;
}

function mergeItemWithDefaults(raw: unknown, properties: Record<string, SettingDescriptor>): Record<string, unknown> {
  const base = buildDefaultItem(properties);
  if (!isPlainObject(raw)) {
    return base;
  }
  return { ...base, ...raw };
}

function renderFieldControl(
  settingKeyPrefix: string,
  propKey: string,
  propDescriptor: SettingDescriptor,
  fieldValue: unknown,
  onFieldChange: (next: unknown) => void,
): React.JSX.Element {
  const subKey = `${settingKeyPrefix}.${propKey}`;

  switch (propDescriptor.type) {
    case 'string':
      return (
        <StringControl
          settingKey={subKey}
          value={(fieldValue as string | null | undefined) ?? ''}
          onChange={(next) => onFieldChange(next)}
        />
      );
    case 'color':
      return (
        <ColorControl
          value={typeof fieldValue === 'string' ? fieldValue : propDescriptor.default}
          onChange={onFieldChange}
        />
      );
    case 'date':
      return (
        <DateControl
          value={typeof fieldValue === 'string' ? fieldValue : propDescriptor.default}
          onChange={onFieldChange}
        />
      );
    case 'boolean':
      return (
        <input
          type="checkbox"
          className="form-check-input"
          checked={Boolean(fieldValue)}
          onChange={(e) => onFieldChange(e.target.checked)}
          aria-label={propDescriptor.label}
        />
      );
    case 'number':
    case 'integer': {
      const parsedNumber =
        typeof fieldValue === 'number' && !Number.isNaN(fieldValue) ? fieldValue : Number(propDescriptor.default);
      return (
        <NumberControl
          settingKey={subKey}
          value={Number.isNaN(parsedNumber) ? 0 : parsedNumber}
          isInteger={propDescriptor.type === 'integer'}
          minimum={propDescriptor.minimum}
          maximum={propDescriptor.maximum}
          onChange={onFieldChange}
        />
      );
    }
    default:
      return (
        <span className="settings-gui__object-array-unsupported">
          This field type is only editable in the JSON settings editor.
        </span>
      );
  }
}

export function ObjectArrayItemsControl(props: ObjectArrayItemsControlProps): React.JSX.Element {
  const { properties, value, onChange } = props;
  const propKeys = Object.keys(properties);
  const [itemIdentities, setItemIdentities] = useState<string[]>(() => value.map(() => crypto.randomUUID()));

  const removeItem = (index: number): void => {
    const next = [...value];
    next.splice(index, 1);
    onChange(next);
    setItemIdentities((current) => current.filter((_, identityIndex) => identityIndex !== index));
  };

  const addItem = (): void => {
    onChange([...value, buildDefaultItem(properties)]);
    setItemIdentities((current) => [...current, crypto.randomUUID()]);
  };

  const updateItemField = (index: number, fieldKey: string, fieldValue: unknown): void => {
    const next = [...value];
    const merged = mergeItemWithDefaults(next[index], properties);
    merged[fieldKey] = fieldValue;
    next[index] = merged;
    onChange(next);
  };

  return (
    <div className="settings-gui__object-array">
      {value.map((raw, index) => {
        const merged = isPlainObject(raw) ? mergeItemWithDefaults(raw, properties) : null;
        const itemIdentity = itemIdentities[index] ?? objectArrayItemKey(raw);
        return (
          <div key={itemIdentity} className="settings-gui__object-array-item">
            {!isPlainObject(raw) && (
              <div className="settings-gui__object-array-invalid">
                Invalid entry (expected an object). Remove it or fix it in the JSON editor.
              </div>
            )}
            {merged != null && (
              <div className="settings-gui__object-array-fields">
                {propKeys.map((propKey) => {
                  const propDescriptor = properties[propKey]!;
                  return (
                    <div key={propKey} className="settings-gui__object-array-field">
                      <label className="settings-gui__object-array-field-label">{propDescriptor.label}</label>
                      {renderFieldControl(`item[${index}]`, propKey, propDescriptor, merged[propKey], (next) =>
                        updateItemField(index, propKey, next),
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="settings-gui__object-array-item-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => removeItem(index)}
                title="Remove"
              >
                &times; Remove
              </button>
            </div>
          </div>
        );
      })}
      <button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={addItem}>
        + Add item
      </button>
    </div>
  );
}
