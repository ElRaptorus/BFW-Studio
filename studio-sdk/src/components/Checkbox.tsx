import type { ChangeEventHandler } from 'react';
import React from 'react';

import type { Studio } from '../../index';

type CheckboxStudioNotNullProps = {
  studio: Studio;
  htmlId?: string;
};

type CheckboxHtmlIdNotNullProps = {
  studio?: Studio;
  htmlId: string;
};

type CheckboxGenericProps = {
  className?: string;
  disabled?: boolean;
  label?: string | React.JSX.Element;
  checked?: boolean;
  htmlAttributes?: object;
  htmlRef?: React.LegacyRef<HTMLInputElement>;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

type CheckboxProps = (CheckboxHtmlIdNotNullProps | CheckboxStudioNotNullProps) & CheckboxGenericProps;

/**
 *
 * To work with the Checkbox component, at least the *studio* property or the *htmlID* property must be specified.
 */
export function Checkbox(props: CheckboxProps): React.JSX.Element {
  if (props.htmlId == null && props.studio == null) {
    throw new Error('At least htmlId or studio property must be set');
  }

  const id = props.htmlId ?? props.studio?.getGuid('checkbox-');
  const inputClassName = props.label == null ? 'form-check-input position-static mr-0' : 'form-check-input';
  const divClassName = props.label == null ? 'form-check form-check-inline mr-0' : 'form-check form-check-inline';

  return (
    <div className={`${divClassName} ${props.className}`}>
      <input
        className={inputClassName}
        type="checkbox"
        id={id}
        name={id}
        checked={props.checked}
        onChange={props.onChange}
        disabled={props.disabled}
        {...props.htmlAttributes}
      />
      {props.label && (
        <label className="form-check-label" htmlFor={id}>
          {props.label}
        </label>
      )}
    </div>
  );
}
