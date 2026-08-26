import type {
  DialogOptionsStrict,
  DialogResponseCallbackFn,
  DialogValidationResult,
} from '#bifrost/contracts/DialogTypes';
import type { IconComponent } from '#bifrost/contracts/IconTypes';

import React, { useCallback, useEffect, useRef } from 'react';

import DialogRenderer from './DialogRenderer';

type DialogProps = {
  options: DialogOptionsStrict;

  // used in docs/machine-sanctum, prevents focussing the `default` action
  noFocus?: boolean;

  responseCallback?: DialogResponseCallbackFn;
  validationResult?: DialogValidationResult;
  iconComponent: IconComponent;
};

export default function DialogContainer(props: DialogProps): React.JSX.Element {
  const modalRef = useRef<HTMLDivElement>(null);

  const focusEventListener = useCallback((event: FocusEvent): void => {
    const focussedElementIsInModalOrTheModal = modalRef.current?.contains(event.target as Node);
    if (!focussedElementIsInModalOrTheModal) {
      modalRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('focusin', focusEventListener);

    return () => {
      document.removeEventListener('focusin', focusEventListener);
    };
  }, [focusEventListener]);

  const divProps: any = { 'data-test--dialog': true };

  return (
    <>
      <div
        ref={modalRef}
        className="modal show kbm-dialog"
        {...divProps}
        style={{ display: 'block' }}
        role="dialog"
        tabIndex="-1"
      >
        <DialogRenderer
          iconComponent={props.iconComponent}
          options={props.options}
          responseCallback={props.responseCallback}
          validationResult={props.validationResult}
        />
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
