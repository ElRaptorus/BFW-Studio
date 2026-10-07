import type { FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';

import React from 'react';

import { initialText, initiallyChecked, optionInitiallyChecked } from './formFieldInitialValue';

type FormRendererFieldProps = {
  field: FormFieldDefinition;
  readOnly?: boolean;
  error?: string;
  /** Runtime value to show instead of the modelled default, for example a submitted value. */
  initialValue?: unknown;
};

export function FormRendererField(props: FormRendererFieldProps): React.JSX.Element {
  const { field, readOnly, error, initialValue } = props;

  if (field.type === 'section_header') {
    return (
      <div className="form-renderer-field form-renderer-field--header">
        <h4 className="form-renderer-field__section-title">{field.label}</h4>
      </div>
    );
  }

  return (
    <div className={`form-renderer-field${error ? ' form-renderer-field--error' : ''}`}>
      <label className="form-renderer-field__label" htmlFor={field.id}>
        {field.label}
        {field.required && <span className="form-renderer-field__required">*</span>}
      </label>
      {renderInput(field, readOnly, initialValue)}
      {field.hint != null && (
        <span className="form-renderer-field__hint" id={`${field.id}-hint`}>
          {field.hint}
        </span>
      )}
      {error != null && (
        <span className="form-renderer-field__error-message" data-test--form-renderer-field-error>
          {error}
        </span>
      )}
    </div>
  );
}

function renderInput(
  field: FormFieldDefinition,
  readOnly: boolean | undefined,
  initialValue: unknown,
): React.JSX.Element {
  const commonProps = {
    id: field.id,
    name: field.id,
    disabled: readOnly,
    'aria-describedby': field.hint ? `${field.id}-hint` : undefined,
    'data-test--form-renderer-input': field.id,
  };

  switch (field.type) {
    case 'text':
      return (
        <input
          {...commonProps}
          type="text"
          className="form-renderer-field__input"
          placeholder={field.placeholder}
          defaultValue={initialText(field, initialValue)}
        />
      );

    case 'number':
      return (
        <input
          {...commonProps}
          type="number"
          className="form-renderer-field__input"
          placeholder={field.placeholder}
          defaultValue={initialText(field, initialValue)}
        />
      );

    case 'date':
      return (
        <input
          {...commonProps}
          type="date"
          className="form-renderer-field__input"
          defaultValue={initialText(field, initialValue)}
        />
      );

    case 'checkbox':
      return (
        <div className="form-renderer-field__checkbox-group">
          {field.options != null && field.options.length > 0 ? (
            field.options.map((option) => (
              <label key={option.value} className="form-renderer-field__checkbox-option">
                <input
                  type="checkbox"
                  name={field.id}
                  value={option.value}
                  disabled={readOnly}
                  defaultChecked={optionInitiallyChecked(field, option, initialValue)}
                />
                <span>{option.label}</span>
              </label>
            ))
          ) : (
            <label className="form-renderer-field__checkbox-option">
              <input {...commonProps} type="checkbox" defaultChecked={initiallyChecked(field, initialValue)} />
              <span>{field.label}</span>
            </label>
          )}
        </div>
      );

    case 'dropdown':
      return (
        <select
          {...commonProps}
          className="form-renderer-field__select"
          defaultValue={initialText(field, initialValue)}
        >
          <option value="">{field.placeholder ?? 'Select...'}</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'radio':
      return (
        <div className="form-renderer-field__radio-group">
          {field.options?.map((option) => (
            <label key={option.value} className="form-renderer-field__radio-option">
              <input
                type="radio"
                name={field.id}
                value={option.value}
                disabled={readOnly}
                defaultChecked={optionInitiallyChecked(field, option, initialValue)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );

    case 'textarea':
      return (
        <textarea
          {...commonProps}
          className="form-renderer-field__textarea"
          placeholder={field.placeholder}
          defaultValue={initialText(field, initialValue)}
          rows={4}
        />
      );

    case 'file':
      return <input {...commonProps} type="file" className="form-renderer-field__file" />;

    case 'toggle':
      return (
        <label className="form-renderer-field__toggle">
          <input
            {...commonProps}
            type="checkbox"
            className="form-renderer-field__toggle-input"
            defaultChecked={initiallyChecked(field, initialValue)}
          />
          <span className="form-renderer-field__toggle-slider" />
          <span className="form-renderer-field__toggle-label form-renderer-field__toggle-label--on">Yes</span>
          <span className="form-renderer-field__toggle-label form-renderer-field__toggle-label--off">No</span>
        </label>
      );

    default:
      return (
        <input
          {...commonProps}
          type="text"
          className="form-renderer-field__input"
          placeholder={field.placeholder}
          defaultValue={initialText(field, initialValue)}
        />
      );
  }
}
