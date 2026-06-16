import Select, { type FormatOptionLabelMeta } from 'react-select';

import React from 'react';

type EnumOption = {
  value: string | number;
  label: string;
  description?: string;
};

type EnumControlProps = {
  settingKey: string;
  value: string | number;
  enumValues: (string | number)[];
  enumLabels?: Record<string, string>;
  enumDescriptions?: string[];
  onChange: (value: string | number) => void;
};

export function EnumControl(props: EnumControlProps): React.JSX.Element {
  const options: EnumOption[] = props.enumValues.map((val, index) => ({
    value: val,
    label: props.enumLabels?.[String(val)] ?? String(val),
    description: props.enumDescriptions?.[index],
  }));

  const currentOption = options.find((enumOption) => enumOption.value === props.value) ?? null;

  const formatOptionLabel = (option: EnumOption, meta: FormatOptionLabelMeta<EnumOption>): React.ReactNode => {
    if (meta.context === 'value' || option.description == null) {
      return <span>{option.label}</span>;
    }
    return (
      <div>
        <div>{option.label}</div>
        <div className="settings-gui__enum-description">{option.description}</div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 400 }}>
      <Select<EnumOption>
        className="react-select"
        classNamePrefix="react-select"
        options={options}
        value={currentOption}
        formatOptionLabel={formatOptionLabel}
        onChange={(selected) => {
          if (selected != null) {
            props.onChange(selected.value);
          }
        }}
        isSearchable={false}
      />
    </div>
  );
}
