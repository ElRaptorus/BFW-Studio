import React from 'react';

import type { FormAction } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

type FormRendererActionsProps = {
  actions: FormAction[];
  readOnly?: boolean;
  onActionClick: (action: FormAction) => void;
};

export function FormRendererActions(props: FormRendererActionsProps): React.JSX.Element {
  const { actions, readOnly, onActionClick } = props;

  return (
    <div className="form-renderer-actions">
      {actions.map((action) => {
        const classNames = ['form-renderer-actions__button'];

        if (action.isDefault) {
          classNames.push('form-renderer-actions__button--primary');
        } else {
          classNames.push('form-renderer-actions__button--secondary');
        }

        if (action.isDanger) {
          classNames.push('form-renderer-actions__button--danger');
        }

        return (
          <button
            key={action.id}
            type="button"
            className={classNames.join(' ')}
            data-test--form-renderer-action-button
            disabled={readOnly}
            onClick={() => onActionClick(action)}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
