import { Icon } from '#components/Icon';

import React, { useSyncExternalStore } from 'react';

import type { DmnSimulatorSession } from '../DmnSimulatorSession';

export type DmnSimulatorInputProps = {
  session: DmnSimulatorSession;
  name: string;
  /** Opens the expression editor for this input. */
  onEdit: (name: string) => void;
};

/** Shows the FEEL value of one input and opens the expression editor on click. Pointer events must not reach the diagram. */
export function DmnSimulatorInput(props: DmnSimulatorInputProps): React.ReactElement {
  useSyncExternalStore(props.session.subscribe, props.session.getRevision);
  const text = props.session.getInputText(props.name);
  const isSet = props.session.hasInputText(props.name);
  const stopPropagation = (event: React.SyntheticEvent): void => event.stopPropagation();
  return (
    <button
      className={`dmn-sim-input${isSet ? '' : ' dmn-sim-input--unset'}`}
      title={isSet ? text : 'Set a FEEL value for this input'}
      aria-label={`Edit simulation input ${props.name}`}
      onMouseDown={stopPropagation}
      onClick={(event) => {
        event.stopPropagation();
        props.onEdit(props.name);
      }}
    >
      <Icon id="ph ph-wrench" />
      <span>{isSet ? text || 'null' : 'not set'}</span>
    </button>
  );
}
