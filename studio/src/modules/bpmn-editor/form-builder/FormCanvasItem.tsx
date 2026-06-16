import React from 'react';

import type { FormFieldDefinition } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

import { FIELD_TYPE_DESCRIPTORS } from './constants';

type FormCanvasItemProps = {
  field: FormFieldDefinition;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
};

export function FormCanvasItem(props: FormCanvasItemProps): React.JSX.Element {
  const { field, isSelected, onSelect, onRemove } = props;
  const descriptor = FIELD_TYPE_DESCRIPTORS.find((entry) => entry.type === field.type);

  return (
    <div
      className={`form-canvas-item${isSelected ? ' form-canvas-item--selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onSelect();
        }
      }}
    >
      <div className="form-canvas-item__drag-handle">
        <i className="ph ph-dots-six-vertical" />
      </div>
      <div className="form-canvas-item__icon">
        <i className={descriptor?.icon ?? 'ph ph-question'} />
      </div>
      <div className="form-canvas-item__content">
        <span className="form-canvas-item__label">{field.label}</span>
        <span className="form-canvas-item__meta">
          {descriptor?.label ?? field.type}
          {field.required && <span className="form-canvas-item__required">required</span>}
        </span>
      </div>
      <button
        type="button"
        className="form-canvas-item__remove"
        title="Remove field"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        <i className="ph ph-x" />
      </button>
    </div>
  );
}
