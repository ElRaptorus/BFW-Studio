import type { FormFieldDefinition } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

type FormRendererFieldProps = {
  field: FormFieldDefinition;
  readOnly?: boolean;
  error?: string;
};

export function FormRendererField(props: FormRendererFieldProps): React.JSX.Element {
  const { field, readOnly, error } = props;

  if (field.type === 'header') {
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
      {renderInput(field, readOnly)}
      {field.hint != null && (
        <span className="form-renderer-field__hint" id={`${field.id}-hint`}>
          {field.hint}
        </span>
      )}
      {error != null && <span className="form-renderer-field__error-message">{error}</span>}
    </div>
  );
}

function renderInput(field: FormFieldDefinition, readOnly?: boolean): React.JSX.Element {
  const commonProps = {
    id: field.id,
    name: field.id,
    disabled: readOnly,
    'aria-describedby': field.hint ? `${field.id}-hint` : undefined,
  };

  switch (field.type) {
    case 'text':
      return (
        <input
          {...commonProps}
          type="text"
          className="form-renderer-field__input"
          placeholder={field.placeholder}
          defaultValue={field.defaultValue ?? ''}
        />
      );

    case 'number':
      return (
        <input
          {...commonProps}
          type="number"
          className="form-renderer-field__input"
          placeholder={field.placeholder}
          defaultValue={field.defaultValue ?? ''}
        />
      );

    case 'date':
      return (
        <input
          {...commonProps}
          type="date"
          className="form-renderer-field__input"
          defaultValue={field.defaultValue ?? ''}
        />
      );

    case 'checkbox':
      return (
        <div className="form-renderer-field__checkbox-group">
          {field.options != null && field.options.length > 0 ? (
            field.options.map((option) => (
              <label key={option.value} className="form-renderer-field__checkbox-option">
                <input type="checkbox" name={field.id} value={option.value} disabled={readOnly} />
                <span>{option.label}</span>
              </label>
            ))
          ) : (
            <label className="form-renderer-field__checkbox-option">
              <input {...commonProps} type="checkbox" defaultChecked={field.defaultValue === 'true'} />
              <span>{field.label}</span>
            </label>
          )}
        </div>
      );

    case 'select':
      return (
        <select {...commonProps} className="form-renderer-field__select" defaultValue={field.defaultValue ?? ''}>
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
                defaultChecked={field.defaultValue === option.value}
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
          defaultValue={field.defaultValue ?? ''}
          rows={4}
        />
      );

    case 'file':
      return <input {...commonProps} type="file" className="form-renderer-field__file" />;

    case 'boolean':
      return (
        <label className="form-renderer-field__toggle">
          <input
            {...commonProps}
            type="checkbox"
            className="form-renderer-field__toggle-input"
            defaultChecked={field.defaultValue === 'true'}
          />
          <span className="form-renderer-field__toggle-slider" />
          <span className="form-renderer-field__toggle-label">{field.defaultValue === 'true' ? 'Yes' : 'No'}</span>
        </label>
      );

    default:
      return (
        <input
          {...commonProps}
          type="text"
          className="form-renderer-field__input"
          placeholder={field.placeholder}
          defaultValue={field.defaultValue ?? ''}
        />
      );
  }
}
