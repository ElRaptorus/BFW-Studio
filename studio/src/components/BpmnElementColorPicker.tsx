import type { Bifrost } from '#bifrost/Bifrost';
import type { BpmnElementColor } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { Fragment, useCallback, useMemo } from 'react';

import { PaneProperty, type SelectOption } from '@evil/bifrost_fw_sdk';

import { ColorPicker } from './ColorPicker';
import { Icon } from './Icon';

export const PREDEFINED_COLORS: BpmnElementColor[] = [
  {
    label: 'Red',
    backgroundColor: '#ffcdd2',
    borderColor: '#e53935',
  },
  {
    label: 'Blue',
    backgroundColor: '#bbdefb',
    borderColor: '#1e88e5',
  },
  {
    label: 'Green',
    backgroundColor: '#c8e6c9',
    borderColor: '#43a047',
  },
  {
    label: 'Purple',
    backgroundColor: '#e1bee7',
    borderColor: '#8e24aa',
  },
  {
    label: 'Orange',
    backgroundColor: '#ffe0b2',
    borderColor: '#fb8c00',
  },
];

const predefinedColorsCopy = [...PREDEFINED_COLORS];
const EMPTY_COLORS: BpmnElementColor[] = [];

export type BpmnElementColorPickerProps = {
  studio: Bifrost;
  initialColor?: BpmnElementColor | null;
  placeholder?: string;
  onElementColorChange: (newValue: SelectOption) => void;
  setBackgroundColor: (backgroundColor: string) => void;
  setBorderColor: (borderColor: string) => void;
};

export function BpmnElementColorPicker(props: BpmnElementColorPickerProps): React.JSX.Element {
  const { studio, initialColor, placeholder, onElementColorChange, setBorderColor, setBackgroundColor } = props;
  const customColors: BpmnElementColor[] = studio.settings.get('bpmn.editor.customColors') ?? EMPTY_COLORS;

  const defaultColorOptions = useMemo(() => predefinedColorsCopy.map((color) => colorToSelectOption(color)), []);
  const customColorOptions = useMemo(
    () => customColors.map((color) => colorToSelectOption(color, true)),
    [customColors],
  );
  const colorOptions = useMemo(
    () => buildColorOptions(defaultColorOptions, customColorOptions),
    [defaultColorOptions, customColorOptions],
  );

  const saveTooltip = 'Save custom color';

  let selectedColor: SelectOption | undefined;
  if (initialColor || !placeholder) {
    selectedColor = colorOptions.find(
      (option) =>
        option.value.borderColor === initialColor?.borderColor &&
        option.value.backgroundColor === initialColor?.backgroundColor,
    );
  }

  const showColorPicker = initialColor != null && selectedColor == null;
  if (showColorPicker) {
    selectedColor = colorOptions.find((option) => option.value === 'custom');
  }

  const onBorderColorChange = useCallback((value: string) => setBorderColor(value), [setBorderColor]);
  const onBackgroundColorChange = useCallback((value: string) => setBackgroundColor(value), [setBackgroundColor]);
  const onSaveClick = useCallback(
    () => studio.commands.executeCommand('bpmn.editor.addCustomColor', [initialColor]),
    [studio, initialColor],
  );

  return (
    <Fragment>
      <PaneProperty
        key={`selected_color_${initialColor?.label}_${initialColor?.backgroundColor}_${initialColor?.borderColor}_${selectedColor?.value.backgroundColor}_${selectedColor?.value.borderColor}`}
        type="select"
        label="Element Color"
        options={colorOptions}
        onChange={onElementColorChange}
        value={selectedColor}
        placeholder={placeholder}
      />
      {showColorPicker && (
        <div
          className="form-row mx-0 align-items-center"
          key={`color-picker__${props.initialColor?.backgroundColor}_${props.initialColor?.borderColor}`}
        >
          <div className="form-group">
            <label className="form-check-label">Border</label>
          </div>
          <div className="form-group col">
            <ColorPicker
              className="color-picker"
              value={initialColor?.borderColor ?? ''}
              onChange={onBorderColorChange}
            />
          </div>
          <div className="form-group">
            <label className="form-check-label">Fill</label>
          </div>
          <div className="form-group col">
            <ColorPicker
              className="color-picker"
              value={initialColor?.backgroundColor ?? ''}
              onChange={onBackgroundColorChange}
            />
          </div>
          <div className="form-group">
            <a
              href="#"
              className="pane-toolbar__icon"
              title={saveTooltip}
              data-bs-toggle="saveTooltip"
              onClick={onSaveClick}
            >
              <Icon id="ph ph-floppy-disk" />
            </a>
          </div>
        </div>
      )}
    </Fragment>
  );
}

function colorToSelectOption(color: BpmnElementColor, italic: boolean = false): SelectOption {
  const style = { '--icon-primary-color': color.backgroundColor, '--icon-secondary-color': color.borderColor } as any;
  return {
    label: (
      <span style={style}>
        <Icon id="bpmn/element/color" /> {italic ? <em>{color.label}</em> : color.label}
      </span>
    ),
    value: color,
  };
}

function buildColorOptions(defaultOptions: SelectOption[], customOptions: SelectOption[]): SelectOption[] {
  const colorOptions: SelectOption[] = [
    {
      label: (
        <span>
          <Icon id="bpmn/element/no-color" /> No Color
        </span>
      ),
      value: 'no_color',
    },
    ...defaultOptions,
    ...customOptions,
    {
      label: (
        <span>
          <Icon id="bpmn/element/color-placeholder" /> Custom Color
        </span>
      ),
      value: 'custom',
    },
  ];

  return colorOptions;
}

export const generateRandomColor = (): string => '#' + ((Math.random() * 0xffffff) << 0).toString(16).padStart(6, '0');
