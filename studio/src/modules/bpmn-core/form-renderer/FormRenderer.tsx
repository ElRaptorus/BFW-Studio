import type { FormAction, FormFieldDefinition } from '#modules/bpmn-editor/BpmnElementTypes';
import { FormActionPreset } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useCallback, useRef, useState } from 'react';

import { FormRendererActions } from './FormRendererActions';
import { FormRendererField } from './FormRendererField';
import './form-renderer.scss';

export type FormRendererSubmitHandler = (result: Record<string, unknown>) => void;
export type FormRendererCancelHandler = (reason: string) => void;

export type FormRendererProps = {
  fields: FormFieldDefinition[];
  actions: FormAction[];
  title?: string;
  readOnly?: boolean;
  onSubmit?: FormRendererSubmitHandler;
  onCancel?: FormRendererCancelHandler;
};

const DEFAULT_ACTIONS: FormAction[] = [
  { id: 'ok', label: 'OK', preset: FormActionPreset.Ok, submitsForm: true, isDefault: true },
];

export function FormRenderer(props: FormRendererProps): React.JSX.Element {
  const { fields, actions, title, readOnly, onSubmit, onCancel } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const effectiveActions = actions.length > 0 ? actions : DEFAULT_ACTIONS;

  const validateFields = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (formRef.current == null) {
      return errors;
    }

    for (const field of fields) {
      if (field.type === 'header') {
        continue;
      }

      const inputElement = formRef.current.elements.namedItem(field.id);

      if (field.type === 'checkbox' && field.options != null && field.options.length > 0) {
        if (field.required) {
          let anyChecked = false;
          if (inputElement instanceof RadioNodeList) {
            for (let i = 0; i < inputElement.length; i++) {
              const checkbox = inputElement[i];
              if (checkbox instanceof HTMLInputElement && checkbox.checked) {
                anyChecked = true;
                break;
              }
            }
          } else if (inputElement instanceof HTMLInputElement) {
            anyChecked = inputElement.checked;
          }
          if (!anyChecked) {
            errors[field.id] = `${field.label} is required`;
          }
        }
        continue;
      }

      let value = '';
      if (inputElement instanceof RadioNodeList) {
        value = inputElement.value;
      } else if (
        inputElement instanceof HTMLInputElement ||
        inputElement instanceof HTMLTextAreaElement ||
        inputElement instanceof HTMLSelectElement
      ) {
        value = inputElement.value;
      }

      if (field.required && (!value || value.trim() === '')) {
        errors[field.id] = `${field.label} is required`;
        continue;
      }

      if (field.pattern && value && value.trim() !== '') {
        try {
          const regex = new RegExp(field.pattern);
          if (!regex.test(value)) {
            errors[field.id] = `${field.label} does not match the expected format`;
          }
        } catch {
          // invalid regex — skip validation
        }
      }
    }

    return errors;
  }, [fields]);

  const collectFormData = useCallback((): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    if (formRef.current == null) {
      return result;
    }

    for (const field of fields) {
      if (field.type === 'header') {
        continue;
      }

      const inputElement = formRef.current.elements.namedItem(field.id);
      if (inputElement == null) {
        continue;
      }

      if (field.type === 'checkbox' && field.options != null && field.options.length > 0) {
        const checkedValues: string[] = [];
        if (inputElement instanceof RadioNodeList) {
          for (let i = 0; i < inputElement.length; i++) {
            const checkbox = inputElement[i];
            if (checkbox instanceof HTMLInputElement && checkbox.checked) {
              checkedValues.push(checkbox.value);
            }
          }
        } else if (inputElement instanceof HTMLInputElement && inputElement.checked) {
          checkedValues.push(inputElement.value);
        }
        result[field.id] = checkedValues;
      } else if (inputElement instanceof RadioNodeList) {
        result[field.id] = inputElement.value || null;
      } else if (inputElement instanceof HTMLInputElement) {
        switch (field.type) {
          case 'checkbox':
          case 'boolean':
            result[field.id] = inputElement.checked;
            break;
          case 'number':
            result[field.id] = inputElement.value !== '' ? parseFloat(inputElement.value) : null;
            break;
          case 'file':
            result[field.id] = inputElement.value || null;
            break;
          default:
            result[field.id] = inputElement.value || null;
            break;
        }
      } else if (inputElement instanceof HTMLTextAreaElement) {
        result[field.id] = inputElement.value || null;
      } else if (inputElement instanceof HTMLSelectElement) {
        result[field.id] = inputElement.value || null;
      }
    }

    return result;
  }, [fields]);

  const handleActionClick = useCallback(
    (action: FormAction) => {
      if (readOnly) {
        return;
      }

      if (action.submitsForm) {
        const errors = validateFields();
        if (Object.keys(errors).length > 0) {
          setValidationErrors(errors);
          return;
        }
        setValidationErrors({});
        const formData = collectFormData();
        onSubmit?.({ _action: action.id, ...formData });
      } else {
        onCancel?.(action.id);
      }
    },
    [readOnly, validateFields, collectFormData, onSubmit, onCancel],
  );

  const handleFormSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const defaultAction = effectiveActions.find((action) => action.isDefault && action.submitsForm);
      if (defaultAction != null) {
        handleActionClick(defaultAction);
      }
    },
    [effectiveActions, handleActionClick],
  );

  return (
    <div className="form-renderer">
      {title != null && (
        <header className="form-renderer__header">
          <h3 className="form-renderer__title">{title}</h3>
        </header>
      )}
      <form ref={formRef} className="form-renderer__form" onSubmit={handleFormSubmit}>
        <section className="form-renderer__body">
          {fields.map((field) => (
            <FormRendererField key={field.id} field={field} readOnly={readOnly} error={validationErrors[field.id]} />
          ))}
          {fields.length === 0 && <p className="form-renderer__empty">No form fields configured.</p>}
        </section>
        <footer className="form-renderer__footer">
          <FormRendererActions actions={effectiveActions} readOnly={readOnly} onActionClick={handleActionClick} />
        </footer>
      </form>
    </div>
  );
}
