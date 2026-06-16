import React, { useEffect, useState } from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';
import type { FormFieldDefinition, FormFieldOption } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';
import { FormFieldType } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

import type { FormBuilderEditorSnapshot } from '../FormBuilderEditorMediator';
import { FormBuilderEditorMediator } from '../FormBuilderEditorMediator';
import { FIELD_TYPE_DESCRIPTORS } from '../constants';

const FORM_BUILDER_DOCUMENT_TYPE = 'bpmn.form-builder';
const HELP_ID = 'bpmn/properties/form_builder_field';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Field Properties';
}

function shouldBeDisplayed(editorDocument: EditorDocument): boolean {
  if (editorDocument?.documentType !== FORM_BUILDER_DOCUMENT_TYPE) {
    return false;
  }
  const snapshot = FormBuilderEditorMediator.getSnapshot();
  return snapshot != null && snapshot.selection.type === 'field';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(_props: PaneComponentProps): React.JSX.Element | null {
  const [snapshot, setSnapshot] = useState<FormBuilderEditorSnapshot | null>(FormBuilderEditorMediator.getSnapshot());

  useEffect(() => {
    const subscription = FormBuilderEditorMediator.subscribe(() => {
      setSnapshot(FormBuilderEditorMediator.getSnapshot());
    });
    return () => subscription.dispose();
  }, []);

  if (snapshot == null || snapshot.selection.type !== 'field') {
    return null;
  }

  const fieldId = (snapshot.selection as { type: 'field'; fieldId: string }).fieldId;
  const selectedField = snapshot.fields.find((field) => field.id === fieldId);
  if (selectedField == null) {
    return null;
  }

  return (
    <PaneBody>
      <FieldPropertiesForm snapshot={snapshot} field={selectedField} />
    </PaneBody>
  );
}

type FieldPropertiesFormProps = {
  snapshot: FormBuilderEditorSnapshot;
  field: FormFieldDefinition;
};

function FieldPropertiesForm(props: FieldPropertiesFormProps): React.JSX.Element {
  const { snapshot, field } = props;

  const updateField = (patch: Partial<FormFieldDefinition>): void => {
    const updated = snapshot.fields.map((existingField) =>
      existingField.id === field.id ? { ...existingField, ...patch } : existingField,
    );
    snapshot.setFields(updated);
  };

  const hasOptions =
    field.type === FormFieldType.Select || field.type === FormFieldType.Radio || field.type === FormFieldType.Checkbox;

  return (
    <>
      <div className="form-group">
        <label className="d-block">ID</label>
        <input
          className="form-control form-control-sm"
          type="text"
          value={field.id}
          onChange={(event) => updateField({ id: event.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="d-block">Label</label>
        <input
          className="form-control form-control-sm"
          type="text"
          data-test--field-inspector-label-input
          value={field.label}
          onChange={(event) => updateField({ label: event.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="d-block">Type</label>
        <select
          className="form-control form-control-sm"
          data-test--field-inspector-type-select
          value={field.type}
          onChange={(event) => updateField({ type: event.target.value as FormFieldType })}
        >
          {FIELD_TYPE_DESCRIPTORS.map((descriptor) => (
            <option key={descriptor.type} value={descriptor.type}>
              {descriptor.label}
            </option>
          ))}
        </select>
      </div>

      {field.type !== FormFieldType.Header && (
        <>
          <div className="form-group">
            <label className="form-check-label">
              <input
                type="checkbox"
                className="form-check-input"
                checked={field.required ?? false}
                onChange={(event) => updateField({ required: event.target.checked })}
              />{' '}
              Required
            </label>
          </div>

          <div className="form-group">
            <label className="d-block">Placeholder</label>
            <input
              className="form-control form-control-sm"
              type="text"
              value={field.placeholder ?? ''}
              onChange={(event) => updateField({ placeholder: event.target.value || undefined })}
            />
          </div>

          <div className="form-group">
            <label className="d-block">Default Value</label>
            <input
              className="form-control form-control-sm"
              type="text"
              value={field.defaultValue ?? ''}
              onChange={(event) => updateField({ defaultValue: event.target.value || undefined })}
            />
          </div>

          <div className="form-group">
            <label className="d-block">Pattern (regex)</label>
            <input
              className="form-control form-control-sm"
              type="text"
              value={field.pattern ?? ''}
              placeholder="e.g. ^[a-z]+$"
              onChange={(event) => updateField({ pattern: event.target.value || undefined })}
            />
          </div>

          <div className="form-group">
            <label className="d-block">Hint</label>
            <input
              className="form-control form-control-sm"
              type="text"
              value={field.hint ?? ''}
              onChange={(event) => updateField({ hint: event.target.value || undefined })}
            />
          </div>
        </>
      )}

      {hasOptions && <OptionsEditor options={field.options ?? []} onChange={(options) => updateField({ options })} />}
    </>
  );
}

type OptionsEditorProps = {
  options: FormFieldOption[];
  onChange: (options: FormFieldOption[]) => void;
};

function OptionsEditor(props: OptionsEditorProps): React.JSX.Element {
  const { options, onChange } = props;

  const addOption = (): void => {
    const newOption: FormFieldOption = { value: `option_${options.length + 1}`, label: `Option ${options.length + 1}` };
    onChange([...options, newOption]);
  };

  const removeOption = (index: number): void => {
    onChange(options.filter((_, optionIndex) => optionIndex !== index));
  };

  const updateOption = (index: number, patch: Partial<FormFieldOption>): void => {
    onChange(options.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)));
  };

  return (
    <div className="form-group">
      <label className="d-block">Options</label>
      {options.map((option, index) => (
        <div key={index} className="d-flex gap-1 mb-1">
          <input
            className="form-control form-control-sm"
            type="text"
            value={option.value}
            placeholder="Value"
            onChange={(event) => updateOption(index, { value: event.target.value })}
          />
          <input
            className="form-control form-control-sm"
            type="text"
            value={option.label}
            placeholder="Label"
            onChange={(event) => updateOption(index, { label: event.target.value })}
          />
          <button type="button" className="btn btn-sm btn-icon" onClick={() => removeOption(index)}>
            <i className="ph ph-x" />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-ghost" onClick={addOption}>
        <i className="ph ph-plus" /> Add Option
      </button>
    </div>
  );
}
