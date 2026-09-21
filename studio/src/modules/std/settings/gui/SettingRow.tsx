import type { Bifrost } from '#bifrost/Bifrost';
import equal from 'fast-deep-equal';

import React from 'react';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';
import { resolveSettingEnum } from '@elraptorus/bfw_studio_sdk';

import { ArrayControl } from './controls/ArrayControl';
import { BooleanControl } from './controls/BooleanControl';
import { ColorControl } from './controls/ColorControl';
import { DateControl } from './controls/DateControl';
import { EnumControl } from './controls/EnumControl';
import { NumberControl } from './controls/NumberControl';
import { ObjectControl } from './controls/ObjectControl';
import { StringControl } from './controls/StringControl';

type SettingRowProps = {
  studio: Bifrost;
  settingKey: string;
  descriptor: SettingDescriptor;
  value: unknown;
  onOpenJsonEditor: () => void;
};

export function SettingRow(props: SettingRowProps): React.JSX.Element {
  const { studio, settingKey, descriptor, value, onOpenJsonEditor } = props;
  const isModified = !equal(value, descriptor.default);
  const isDeprecated = descriptor.deprecated != null;

  const resetToDefault = (): void => {
    studio.settings.set(settingKey, descriptor.default);
  };

  const labelClassName = [
    'settings-gui__row-label',
    isModified ? 'settings-gui__row-label--modified' : '',
    isDeprecated ? 'settings-gui__row-label--deprecated' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const isBoolean = descriptor.type === 'boolean';

  const rowClassName = [
    'settings-gui__row',
    isDeprecated ? 'settings-gui__row--deprecated' : '',
    isBoolean ? 'settings-gui__row--boolean' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (isBoolean) {
    return (
      <div className={rowClassName}>
        <div className="settings-gui__row-header">
          <span className={labelClassName}>{descriptor.label}</span>
          {isModified && (
            <button className="settings-gui__reset-btn" onClick={resetToDefault} title="Reset to default">
              <i className="ph ph-arrow-counter-clockwise" />
            </button>
          )}
        </div>
        <div className="settings-gui__row-boolean-control">
          <BooleanControl
            settingKey={settingKey}
            value={value as boolean}
            onChange={(newValue) => studio.settings.set(settingKey, newValue)}
          />
          <span className="settings-gui__row-description">{descriptor.description}</span>
        </div>
        {isDeprecated && <div className="settings-gui__row-deprecation">{descriptor.deprecated}</div>}
      </div>
    );
  }

  return (
    <div className={rowClassName}>
      <div className="settings-gui__row-header">
        <span className={labelClassName}>{descriptor.label}</span>
        {isModified && (
          <button className="settings-gui__reset-btn" onClick={resetToDefault} title="Reset to default">
            <i className="ph ph-arrow-counter-clockwise" />
          </button>
        )}
      </div>
      <div className="settings-gui__row-description">{descriptor.description}</div>
      {isDeprecated && <div className="settings-gui__row-deprecation">{descriptor.deprecated}</div>}
      <div className="settings-gui__row-control">
        {renderControl(studio, settingKey, descriptor, value, onOpenJsonEditor)}
      </div>
    </div>
  );
}

function renderControl(
  studio: Bifrost,
  key: string,
  descriptor: Exclude<SettingDescriptor, { type: 'boolean' }>,
  value: unknown,
  onOpenJsonEditor: () => void,
): React.JSX.Element {
  const onChange = (newValue: any): void => {
    studio.settings.set(key, newValue);
  };

  switch (descriptor.type) {
    case 'color':
      return <ColorControl value={value as string} onChange={onChange} />;

    case 'date':
      return <DateControl value={value as string} onChange={onChange} />;

    case 'string': {
      const resolvedEnum = resolveSettingEnum(descriptor.enum);
      if (resolvedEnum != null) {
        return (
          <EnumControl
            settingKey={key}
            value={value as string}
            enumValues={resolvedEnum}
            enumLabels={resolveSettingEnum(descriptor.enumLabels)}
            enumDescriptions={descriptor.enumDescriptions}
            onChange={onChange}
          />
        );
      }
      return <StringControl settingKey={key} value={value as string | null} onChange={onChange} />;
    }

    case 'number':
    case 'integer': {
      const resolvedEnum = resolveSettingEnum(descriptor.enum);
      if (resolvedEnum != null) {
        return (
          <EnumControl
            settingKey={key}
            value={value as number}
            enumValues={resolvedEnum}
            enumLabels={resolveSettingEnum(descriptor.enumLabels)}
            onChange={onChange}
          />
        );
      }
      return (
        <NumberControl
          settingKey={key}
          value={value as number}
          isInteger={descriptor.type === 'integer'}
          minimum={descriptor.minimum}
          maximum={descriptor.maximum}
          onChange={onChange}
        />
      );
    }

    case 'array':
      return (
        <ArrayControl
          value={value as unknown[]}
          itemsDescriptor={descriptor.items}
          onChange={onChange}
          onOpenJsonEditor={onOpenJsonEditor}
        />
      );

    case 'object':
      return <ObjectControl settingKey={key} onOpenJsonEditor={onOpenJsonEditor} />;
  }
}
