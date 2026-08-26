import type { ChangeEventHandler, Ref } from 'react';
import React, { useState } from 'react';

type CheckboxProps = {
  htmlId?: string;
  className?: string;
  disabled?: boolean;
  label?: string | React.JSX.Element;
  checked?: boolean;
  htmlAttributes?: object;
  ref?: Ref<HTMLInputElement>;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

/**
 * Uncontrolled id is generated once per mount: `checkbox-${crypto.randomUUID()}`.
 * Pass `htmlId` when a stable, testable id is required.
 */
export function Checkbox({
  htmlId,
  className,
  disabled,
  label,
  checked,
  htmlAttributes,
  ref,
  onChange,
}: CheckboxProps): React.JSX.Element {
  const [generatedId] = useState(() => `checkbox-${crypto.randomUUID()}`);
  const id = htmlId ?? generatedId;
  const inputClassName = label == null ? 'form-check-input position-static mr-0' : 'form-check-input';
  const divClassName = label == null ? 'form-check form-check-inline mr-0' : 'form-check form-check-inline';

  return (
    <div className={`${divClassName} ${className}`}>
      <input
        className={inputClassName}
        type="checkbox"
        id={id}
        name={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        ref={ref}
        {...htmlAttributes}
      />
      {label && (
        <label className="form-check-label" htmlFor={id}>
          {label}
        </label>
      )}
    </div>
  );
}
