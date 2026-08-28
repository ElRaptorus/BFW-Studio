import type { SelectInstance } from 'react-select';
import { components } from 'react-select';
import CreatableSelect from 'react-select/async-creatable';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function assertNotNull<T>(value: T, nameForErrorMessage: string): asserts value is NonNullable<T> {
  if (value == null) {
    throw new Error(`Unexpected value: \`${nameForErrorMessage}\` should not be null here.`);
  }
}

export type Suggestion =
  string | { label: string | React.JSX.Element; sublabel?: string | React.JSX.Element; value: string };

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
  const { onChange, suggestions, htmlId, placeholder, isClearable: isClearableProp, propertyValue } = props;
  const creatableSelectRef = useRef<SelectInstance>(null);
  const suggestionsRef = useRef(suggestions);

  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  const defaultValueFromProps = optionize(propertyValue);

  // Uncontrolled: `defaultValue` is read once. Passing `value={selectedOption}`
  // makes the select fully controlled and blocks the Creatable "Use …" path
  // (typed text never becomes a create option). Do not seed `defaultInputValue`
  // with the selected option — that puts the text in the search box, hides
  // `.react-select__single-value`, and filters the menu so other options never
  // appear (e.g. a newly created message name on a second Send Task).
  const [defaultValue] = useState(defaultValueFromProps);

  const isClearable = isClearableProp ?? false;
  const loadOptions = useCallback(async () => {
    const resolvedSuggestions = await suggestionsRef.current;
    return resolvedSuggestions.map(optionize).filter((option): option is ReactSelectOption => option != null);
  }, []);

  const filterFunction = useCallback((candidate: any, inputValue: string): boolean => {
    const text = candidate.data?.filterText || candidate.label;
    return text.toString().toLowerCase().includes(inputValue.toLowerCase());
  }, []);

  const clearSearchInput = (action: 'input-blur' | 'menu-close'): void => {
    assertNotNull(creatableSelectRef.current, 'creatableSelectRef.current');
    creatableSelectRef.current.onInputChange('', {
      prevInputValue: '',
      action,
    });
  };

  const handleInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      creatableSelectRef.current!.blur();
      setTimeout(() => {
        if (creatableSelectRef.current == null) {
          return;
        }
        clearSearchInput('menu-close');
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

    clearSearchInput('input-blur');
    clearSearchInput('menu-close');

    creatableSelectRef.current.props.onMenuClose();

    creatableSelectRef.current.setState({
      focusedValue: null,
      isFocused: false,
    });
  };

  const handleChange = useCallback(
    (newValue: any, actionMeta: { action?: string }) => {
      let selectedValue = '';
      if (newValue != null) {
        selectedValue = typeof newValue === 'string' ? newValue : (newValue.value ?? '');
      }
      if (actionMeta?.action === 'clear' || selectedValue.trim() === '') {
        // clearValue() nulls the option but does not reset inputValue. Do not
        // commit `{ value: '' }` — optionize of that still hasValue(), so the X
        // stays on a blank-looking field. Stay uncontrolled; empty the input and
        // tell the parent there is no selection.
        creatableSelectRef.current?.onInputChange('', {
          prevInputValue: '',
          action: 'set-value',
        });
        onChange(null);
        return;
      }
      onChange(newValue);
    },
    [onChange],
  );

  const formatOptionLabel = useCallback((option: any, meta: { context: string }) => {
    if (meta.context === 'value') {
      return option.value;
    }
    return option.label;
  }, []);

  const onInputKeyDownRef = useRef(handleInputKeyDown);
  const overwriteInternalOnInputBlurRef = useRef(handleInputBlur);

  useEffect(() => {
    onInputKeyDownRef.current = handleInputKeyDown;
    overwriteInternalOnInputBlurRef.current = handleInputBlur;
  });

  const InputComponent = useMemo(() => {
    // react-select requires a component type for Input; latest handlers live in refs.
    // eslint-disable-next-line @eslint-react/no-nested-component-definitions -- react-select Input override
    return function Input(inputProps: any) {
      return (
        <components.Input
          {...inputProps}
          onBlur={(event: any) => overwriteInternalOnInputBlurRef.current(event)}
          onKeyDown={(event: any) => {
            if (event.key === 'Escape') {
              onInputKeyDownRef.current(event);
              return;
            }
            inputProps.onKeyDown?.(event);
          }}
        />
      );
    };
  }, []);

  const formatCreateLabel = useCallback((inputValue: string) => `Use "${inputValue}" ...`, []);
  const selectComponents = useMemo(() => ({ Option, Input: InputComponent }), [InputComponent]);

  return (
    <CreatableSelect
      ref={creatableSelectRef}
      id={htmlId}
      instanceId={htmlId}
      placeholder={placeholder}
      defaultValue={defaultValue}
      onChange={handleChange}
      loadOptions={loadOptions}
      className="react-select"
      classNamePrefix="react-select"
      createOptionPosition={'first'}
      formatCreateLabel={formatCreateLabel}
      formatOptionLabel={formatOptionLabel}
      defaultOptions={true}
      components={selectComponents}
      isClearable={isClearable}
      filterOption={filterFunction}
      blurInputOnSelect={true}
    />
  );
}

function optionize(givenSuggestion: Suggestion | null | undefined): ReactSelectOption | null {
  if (givenSuggestion == null) {
    return null;
  }

  if (typeof givenSuggestion === 'string') {
    if (givenSuggestion.trim() === '') {
      return null;
    }
    return { label: givenSuggestion, value: givenSuggestion, filterText: givenSuggestion };
  }

  if (givenSuggestion.value == null || givenSuggestion.value.trim() === '') {
    return null;
  }

  if (givenSuggestion.sublabel == null) {
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
