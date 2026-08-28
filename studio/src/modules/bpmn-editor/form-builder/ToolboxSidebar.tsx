import type { FormFieldType } from '#modules/bpmn-editor/BpmnElementTypes';
import { FormActionPreset } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import './ToolboxSidebar.scss';
import { FIELD_TYPE_DESCRIPTORS, createDefaultAction, createDefaultField } from './constants';
import type { FormBuilderState } from './useBpmnFormBuilderState';

type ToolboxSidebarProps = {
  state: FormBuilderState;
};

export function ToolboxSidebar(props: ToolboxSidebarProps): React.JSX.Element {
  const { state } = props;

  const handleAddField = (type: FormFieldType): void => {
    const newField = createDefaultField(type);
    state.setFields([...state.fields, newField]);
    state.selectField(newField.id);
  };

  const handleAddAction = (preset: FormActionPreset): void => {
    const newAction = createDefaultAction(preset);
    state.setActions([...state.actions, newAction]);
    state.selectAction(newAction.id);
  };

  return (
    <aside className="form-builder-toolbox">
      <section className="form-builder-toolbox__section">
        <h4 className="form-builder-toolbox__heading">Add Fields</h4>
        <div className="form-builder-toolbox__grid">
          {FIELD_TYPE_DESCRIPTORS.map((descriptor) => (
            <button
              key={descriptor.type}
              type="button"
              className="form-builder-toolbox__item"
              data-test--form-builder-toolbox-field={descriptor.type}
              title={descriptor.label}
              onClick={() => handleAddField(descriptor.type)}
            >
              <i className={descriptor.icon} />
              <span className="form-builder-toolbox__item-label">{descriptor.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="form-builder-toolbox__section">
        <h4 className="form-builder-toolbox__heading">Add Actions</h4>
        <div className="form-builder-toolbox__grid">
          <button
            type="button"
            className="form-builder-toolbox__item"
            data-test--form-builder-toolbox-action="confirm"
            title="Add Confirm action"
            onClick={() => handleAddAction(FormActionPreset.Confirm)}
          >
            <i className="ph ph-check" />
            <span className="form-builder-toolbox__item-label">Confirm</span>
          </button>
          <button
            type="button"
            className="form-builder-toolbox__item"
            data-test--form-builder-toolbox-action="ok"
            title="Add OK action"
            onClick={() => handleAddAction(FormActionPreset.Ok)}
          >
            <i className="ph ph-check-circle" />
            <span className="form-builder-toolbox__item-label">OK</span>
          </button>
          <button
            type="button"
            className="form-builder-toolbox__item"
            data-test--form-builder-toolbox-action="yes"
            title="Add Yes action"
            onClick={() => handleAddAction(FormActionPreset.Yes)}
          >
            <i className="ph ph-thumbs-up" />
            <span className="form-builder-toolbox__item-label">Yes</span>
          </button>
          <button
            type="button"
            className="form-builder-toolbox__item"
            data-test--form-builder-toolbox-action="no"
            title="Add No action"
            onClick={() => handleAddAction(FormActionPreset.No)}
          >
            <i className="ph ph-thumbs-down" />
            <span className="form-builder-toolbox__item-label">No</span>
          </button>
          <button
            type="button"
            className="form-builder-toolbox__item"
            data-test--form-builder-toolbox-action="cancel"
            title="Add Cancel action"
            onClick={() => handleAddAction(FormActionPreset.Cancel)}
          >
            <i className="ph ph-x" />
            <span className="form-builder-toolbox__item-label">Cancel</span>
          </button>
          <button
            type="button"
            className="form-builder-toolbox__item"
            data-test--form-builder-toolbox-action="custom"
            title="Add Custom action"
            onClick={() => handleAddAction(FormActionPreset.Custom)}
          >
            <i className="ph ph-pencil-simple" />
            <span className="form-builder-toolbox__item-label">Custom</span>
          </button>
        </div>
      </section>
    </aside>
  );
}
