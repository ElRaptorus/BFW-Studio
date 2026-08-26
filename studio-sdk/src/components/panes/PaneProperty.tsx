import Select, { components } from 'react-select';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { type PropertySearchQuery, valueMatchesSearchQuery } from '../../contracts/PropertySearch';
import { FormInput } from '../FormInput';
import type { PropertyValidationFn } from './PropertyValidation';
import { combinePropertyValidators } from './PropertyValidation';
import type { Suggestion } from './PropertyValueWithSuggestions';
import { PropertyValueWithSuggestions } from './PropertyValueWithSuggestions';

type PanePropertyProps =
  | PanePropertyProps_Text
  | PanePropertyProps_Textarea
  | PanePropertyProps_TextWithSuggestions
  | PanePropertyProps_Select;

type PanePropertyProps_Text = {
  type: 'text';

  label?: string | React.JSX.Element;
  value: string;
  htmlId?: string;
  placeholder?: string;
  onChange?: (value: any) => void;
  onCommit?: (value: any) => void;
  onValidate?: PropertyValidationFn | PropertyValidationFn[];

  disabled?: boolean;
  className?: string;
  searchQuery?: PropertySearchQuery;
  valueRef?: { current: string };
  htmlAttributes?: object;
};

type PanePropertyProps_Textarea = {
  type: 'textarea';

  label?: string | React.JSX.Element;
  value: string;
  htmlId?: string;
  placeholder?: string;
  onChange?: (value: any) => void;
  onCommit?: (value: any) => void;
  onValidate?: PropertyValidationFn | PropertyValidationFn[];

  disabled?: boolean;
  className?: string;
  rows?: number;
  valueRef?: { current: string };
};

type PanePropertyProps_TextWithSuggestions = {
  type: 'text-with-suggestions';

  label: string | React.JSX.Element;
  value: string;
  placeholder?: string;
  suggestions: Promise<Suggestion[]>;
  onCommit: (value: any) => void;
  onValidate?: PropertyValidationFn | PropertyValidationFn[];

  htmlId?: string;
  className?: string;
  searchQuery?: PropertySearchQuery;
  isClearable?: boolean;
};

type PanePropertyProps_Select = {
  type: 'select';

  label?: string | React.JSX.Element;
  value?: SelectOption;
  placeholder?: string;
  options: SelectOption[];
  onChange: (value: any) => void;

  isMulti?: boolean;
  isClearable?: boolean;
  htmlId?: string;
  className?: string;
};

export type SelectOption = { label: string | React.JSX.Element; value: any; dataTestOptionValue?: string };

export function PaneProperty(props: PanePropertyProps): React.JSX.Element {
  switch (props.type) {
    case 'text':
      return <PanePropertyText {...props} />;
    case 'textarea':
      return <PanePropertyTextarea {...props} />;
    case 'text-with-suggestions':
      return <PanePropertyTextWithSuggestions {...props} />;
    case 'select':
      return <PanePropertySelect {...props} />;
    default:
      throw new Error(`Could not render PaneProperty: ${JSON.stringify(props, null, 2)}`);
  }
}

function PanePropertyText(props: PanePropertyProps_Text): React.JSX.Element {
  const {
    onChange,
    onCommit,
    onValidate,
    searchQuery,
    value,
    className: classNameProp,
    disabled,
    htmlId,
    placeholder,
    valueRef,
    htmlAttributes,
    label,
  } = props;
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  let searchClassName = '';
  if (searchQuery && valueMatchesSearchQuery(value, searchQuery)) {
    searchClassName = 'form-group--with-search-result';
  }

  let errorClassName = '';
  if (validationErrors.length > 0) {
    errorClassName = 'form-group--with-validation-error';
  }

  const className = classNameProp ?? 'form-group';

  const validateAndCommit = useCallback(
    (newValue: any): void => {
      if (!onCommit) {
        return;
      }
      if (onValidate == null) {
        onCommit(newValue);
        return;
      }

      const validationFns = Array.isArray(onValidate) ? onValidate : [onValidate];
      const combinedValidationFn = combinePropertyValidators(...validationFns);
      const currentValidationErrors = combinedValidationFn(newValue);
      const noErrors = currentValidationErrors.length === 0;

      if (noErrors) {
        onCommit(newValue);
        setValidationErrors([]);
      } else {
        setValidationErrors(currentValidationErrors);
      }
    },
    [onCommit, onValidate],
  );

  const onCancelHandler = useCallback(() => validateAndCommit(value), [validateAndCommit, value]);

  const key = disabled ? value : undefined;

  return (
    <div className={`${className} ${searchClassName} ${errorClassName}`} key={key}>
      {label != null && <label className="d-block">{label}</label>}
      <FormInput
        htmlId={htmlId}
        type="text"
        className="form-control form-control-sm"
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        onCommit={onCommit ? validateAndCommit : undefined}
        onCancel={onCommit ? onCancelHandler : undefined}
        disabled={disabled}
        valueRef={valueRef}
        htmlAttributes={htmlAttributes}
      />
      <ValidationErrors validationErrors={validationErrors} />
    </div>
  );
}

function PanePropertyTextarea(props: PanePropertyProps_Textarea): React.JSX.Element {
  const {
    onChange,
    onCommit,
    onValidate,
    value,
    className: classNameProp,
    disabled,
    htmlId,
    placeholder,
    label,
    rows,
    valueRef,
  } = props;
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [currentValue, setCurrentValue] = useState(value);
  const lastSyncedToRef = useRef(value);

  const syncedValue = props.value;
  const [prevSyncedValue, setPrevSyncedValue] = useState(syncedValue);
  if (syncedValue !== prevSyncedValue) {
    setPrevSyncedValue(syncedValue);
    setCurrentValue(syncedValue);
  }

  useEffect(() => {
    if (valueRef) {
      valueRef.current = syncedValue;
      lastSyncedToRef.current = syncedValue;
    }
  }, [syncedValue, valueRef]);

  useEffect(() => {
    if (!valueRef) {
      return;
    }
    const checkForExternalMutation = (): void => {
      if (valueRef.current !== lastSyncedToRef.current) {
        const externalValue = valueRef.current;
        lastSyncedToRef.current = externalValue;
        setCurrentValue(externalValue);
      }
    };
    const interval = setInterval(checkForExternalMutation, 50);
    return () => clearInterval(interval);
  }, [valueRef]);

  let errorClassName = '';
  if (validationErrors.length > 0) {
    errorClassName = 'form-group--with-validation-error';
  }

  const className = classNameProp ?? 'form-group';

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      setCurrentValue(newValue);
      if (valueRef) {
        valueRef.current = newValue;
        lastSyncedToRef.current = newValue;
      }
      if (onChange) {
        onChange(newValue);
      }
    },
    [onChange, valueRef],
  );

  const handleBlur = useCallback(() => {
    if (!onCommit) {
      return;
    }
    if (onValidate == null) {
      onCommit(currentValue);
      return;
    }
    const validationFns = Array.isArray(onValidate) ? onValidate : [onValidate];
    const combinedValidationFn = combinePropertyValidators(...validationFns);
    const currentValidationErrors = combinedValidationFn(currentValue);
    if (currentValidationErrors.length === 0) {
      onCommit(currentValue);
      setValidationErrors([]);
    } else {
      setValidationErrors(currentValidationErrors);
    }
  }, [onCommit, onValidate, currentValue]);

  return (
    <div className={`${className} ${errorClassName}`}>
      {label != null && <label className="d-block">{label}</label>}
      <textarea
        id={htmlId}
        className="form-control form-control-sm"
        value={currentValue}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        rows={rows ?? 3}
      />
      <ValidationErrors validationErrors={validationErrors} />
    </div>
  );
}

function PanePropertyTextWithSuggestions(props: PanePropertyProps_TextWithSuggestions): React.JSX.Element {
  const {
    onCommit,
    onValidate,
    searchQuery,
    value,
    className: classNameProp,
    htmlId,
    placeholder,
    suggestions,
    isClearable,
    label,
  } = props;
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  let searchClassName = '';
  if (searchQuery && valueMatchesSearchQuery(value, searchQuery)) {
    searchClassName = 'form-group--with-search-result';
  }

  const validateAndCommit = useCallback(
    (newValue: any): void => {
      if (onValidate == null) {
        onCommit(newValue);
        return;
      }

      const validationFns = Array.isArray(onValidate) ? onValidate : [onValidate];
      const combinedValidationFn = combinePropertyValidators(...validationFns);
      const currentValidationErrors = combinedValidationFn(newValue);
      const noErrors = currentValidationErrors.length === 0;

      if (noErrors) {
        onCommit(newValue);
        setValidationErrors([]);
      } else {
        setValidationErrors(currentValidationErrors);
      }
    },
    [onCommit, onValidate],
  );
  const className = classNameProp ?? 'form-group';

  return (
    <div className={`${className} ${searchClassName}`}>
      {label != null && <label className="d-block">{label}</label>}
      <PropertyValueWithSuggestions
        htmlId={htmlId}
        propertyValue={value}
        placeholder={placeholder}
        onChange={validateAndCommit}
        suggestions={suggestions}
        isClearable={isClearable}
      />
      <ValidationErrors validationErrors={validationErrors} />
    </div>
  );
}

function ValidationErrors(props: any): React.JSX.Element {
  return props.validationErrors.map((validationError: string) => (
    <div className="text-danger" key={validationError}>
      {validationError}
    </div>
  ));
}

function PanePropertySelect(props: PanePropertyProps_Select): React.JSX.Element {
  const className = props.className ?? 'form-group';

  return (
    <div className={className}>
      {props.label != null && <label>{props.label}</label>}
      <Select
        id={props.htmlId}
        options={props.options}
        isSearchable={false}
        isMulti={props.isMulti === true}
        isClearable={props.isClearable === true}
        defaultValue={props.value}
        className="react-select"
        classNamePrefix="react-select"
        onChange={props.onChange}
        components={{ Option }}
        placeholder={props.placeholder}
      ></Select>
    </div>
  );
}

function Option(props: any): React.JSX.Element {
  return (
    <div data-test-option-value={props.data.dataTestOptionValue ?? props.data.value}>
      <components.Option {...props} />
    </div>
  );
}
