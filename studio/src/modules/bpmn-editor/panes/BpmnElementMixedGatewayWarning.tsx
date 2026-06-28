import React from 'react';

export type BpmnElementMixedGatewayWarningProps = {
  iconComponent: any;
};

export function BpmnElementMixedGatewayWarning(props: BpmnElementMixedGatewayWarningProps): React.JSX.Element {
  const Icon = props.iconComponent;

  return (
    <div className="pane-item pane-item--hoverable">
      <div className="pane-item__squared-rounded-icon" data-bs-title="Invalid Gateway usage" data-bs-toggle="tooltip">
        <span className={`pane-item__options-icon pane-item__options-icon--no-hover pane-item__options-icon--warning`}>
          <Icon id="ph ph-warning" />
        </span>
      </div>
      <div className="pane-item__text">
        Using Gatways with mixed Split- and Join- Purpose is not supported by the engine.
        <br />
        Trying to execute this gateway will cause a process error.
      </div>
    </div>
  );
}
