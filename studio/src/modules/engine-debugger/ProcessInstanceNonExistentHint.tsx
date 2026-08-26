import type { Bifrost } from '#bifrost/Bifrost';
import { Icon } from '#components/Icon';

import React from 'react';

import './ProcessInstanceNonExistentHint.scss';

export type ProcessInstanceNonExistentHintProps = {
  studio: Bifrost;
  processInstanceId: string;
};

export function ProcessInstanceNonExistentHint(props: ProcessInstanceNonExistentHintProps): React.JSX.Element {
  return (
    <div className="pane-item">
      <div className="process-instance-non-existent-text">
        <h3 className="process-instance-non-existent-text__heading">
          <span className="pane-item__options-icon pane-item__options-icon--no-hover pane-item__options-icon--warning process-instance-non-existent-text__icon">
            <Icon id="ph ph-warning" />
          </span>
          Process instance {props.processInstanceId} not found.
        </h3>
        <p>
          The Process Instance may have been removed from the Engine. Or you may not have permission to see it. Contact
          your administrator for support.{' '}
        </p>
      </div>
    </div>
  );
}
