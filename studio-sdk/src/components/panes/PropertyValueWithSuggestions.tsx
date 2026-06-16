import type { SelectInstance } from 'react-select';
import { components } from 'react-select';
import CreatableSelect from 'react-select/async-creatable';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { assertNotNull } from '../../common';

export type Suggestion =
  | string
  | { label: string | React.JSX.Element; sublabel?: string | React.JSX.Element; value: string };

type ReactSelectOption = {
  label: string | React.JSX.Element;
  value: string;
  filterText?: string;
};

type PropertyValueWithSuggestionsProps = {
  propertyValue: Suggestion;
  placeholder?: string;
  onChange: (newValue: any) => void;
  suggestions: Promise<Suggestion[]>;
  htmlId?: string;
  isClearable?: boolean;
};

export function PropertyValueWithSuggestions(props: PropertyValueWithSuggestionsProps): React.JSX.Element {
  const creatableSelectRef = useRef<SelectInstance>(null);

  const defaultValueFromProps = optionize(props.propertyValue);

  const [defaultValue, _setDefaultValue] = useState(defaultValueFromProps);
  const [defaultInputValue, _setDefaultInputValue] = useState(defaultValueFromProps?.value ?? defaultValueFromProps);

  const isClearable = props.isClearable ?? false;
  const loadOptions = useCallback(async () => {
    const resolvedSuggestions = await props.suggestions;
    return resolvedSuggestions.map(optionize);
  }, [props.suggestions]);

  const filterFunction = useCallback((candidate: any, inputValue: string): boolean => {
    const text = candidate.data?.filterText || candidate.label;
    return text.toString().toLowerCase().includes(inputValue.toLowerCase());
  }, []);

  const handleInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      creatableSelectRef.current!.blur();
      setTimeout(() => {
        creatableSelectRef.current!.onInputChange((creatableSelectRef.current!.props?.value as any)?.value ?? '', {
          prevInputValue: (creatableSelectRef.current!.props?.value as any)?.value,
          action: 'menu-close',
        });
      }, 32);
    }
  };

  const handleInputBlur = (event: any) => {
    assertNotNull(creatableSelectRef.current, 'creatableSelectRef.current');
    if (
      creatableSelectRef.current.menuListRef &&
      creatableSelectRef.current.menuListRef.contains(document.activeElement)
    ) {
      creatableSelectRef.current.inputRef!.focus();

      return;
    }

    if (creatableSelectRef.current.props.onBlur) {
      creatableSelectRef.current.props.onBlur(event);
    }

    creatableSelectRef.current.onInputChange((creatableSelectRef.current.props?.value as any)?.value ?? '', {
      prevInputValue: (creatableSelectRef.current.props?.value as any)?.value,
      action: 'input-blur',
    });

    creatableSelectRef.current.onInputChange((creatableSelectRef.current.props?.value as any)?.value ?? '', {
      prevInputValue: (creatableSelectRef.current.props?.value as any)?.value,
      action: 'menu-close',
    });

    creatableSelectRef.current.props.onMenuClose();

    creatableSelectRef.current.setState({
      focusedValue: null,
      isFocused: false,
    });
  };

  const onInputKeyDownRef = useRef(handleInputKeyDown);
  const overwriteInternalOnInputBlurRef = useRef(handleInputBlur);

  useEffect(() => {
    onInputKeyDownRef.current = handleInputKeyDown;
    overwriteInternalOnInputBlurRef.current = handleInputBlur;
  });

  const InputComponent = useMemo(() => {
    return function Input(inputProps: any) {
      return (
        <components.Input
          {...inputProps}
          onBlur={(event: any) => overwriteInternalOnInputBlurRef.current(event)}
          onKeyDown={(event: any) => onInputKeyDownRef.current(event)}
        />
      );
    };
  }, []);

  const formatCreateLabel = useCallback((inputValue: string) => `Use "${inputValue}" ...`, []);
  const selectComponents = useMemo(() => ({ Option, Input: InputComponent }), [InputComponent]);

  return (
    <CreatableSelect
      ref={creatableSelectRef}
      id={props.htmlId}
      placeholder={props.placeholder}
      defaultValue={defaultValue}
      onChange={props.onChange}
      loadOptions={loadOptions}
      className="react-select"
      classNamePrefix="react-select"
      createOptionPosition={'first'}
      formatCreateLabel={formatCreateLabel}
      defaultOptions={true}
      components={selectComponents}
      isClearable={isClearable}
      filterOption={filterFunction}
      defaultInputValue={defaultInputValue}
    />
  );
}

function optionize(givenSuggestion: Suggestion): ReactSelectOption {
  if (typeof givenSuggestion === 'string') {
    return { label: givenSuggestion, value: givenSuggestion, filterText: givenSuggestion };
  }

  if (givenSuggestion?.sublabel == null) {
    return givenSuggestion;
  }

  let tooltip;
  if (typeof givenSuggestion.sublabel === 'string') {
    tooltip = `${givenSuggestion.label} • ${givenSuggestion.sublabel}`;
  }

  return {
    label: (
      <div className="property-suggestion" title={tooltip}>
        <span className="property-suggestion__label">{givenSuggestion.label}</span>{' '}
        <span className="property-suggestion__sublabel">{givenSuggestion.sublabel}</span>
      </div>
    ),
    value: givenSuggestion.value,
    filterText: tooltip,
  };
}

function Option(optionProps: any): React.JSX.Element {
  const currentValue = optionProps.getValue()[0];

  const onClick = () => {
    const newValue = { ...optionProps.data };
    if (currentValue?.value === optionProps.data.value) {
      newValue.label = newValue.value;
    }
    optionProps.selectOption(newValue);
  };

  const innerProps = { ...optionProps.innerProps, onClick };

  return (
    <div data-test-option-value={optionProps.data.value}>
      <components.Option {...optionProps} innerProps={innerProps} />
    </div>
  );
}
