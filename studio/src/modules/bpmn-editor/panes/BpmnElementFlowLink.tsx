import React, { useRef } from 'react';

import type { IconComponent } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../BpmnDocumentModel';

type FlowLinkProps = {
  id: string;
  label: string;
  iconComponent: IconComponent;
  flowId: string;
  bpmnDocumentModel: BpmnDocumentModel;
};

type ConditionalFlowLinkProps = FlowLinkProps & {
  condition: string;
  ignoreMissingCondition: boolean;
};

export function FlowLink(props: FlowLinkProps): React.JSX.Element {
  const Icon = props.iconComponent;
  const iconDivRef = useRef<HTMLDivElement | null>(null);

  const onClick = (event: React.MouseEvent): void => {
    if (event.target === iconDivRef.current || iconDivRef.current?.contains(event.target as Node)) {
      event.stopPropagation();
      return;
    }

    props.bpmnDocumentModel.selection.selectElement(props.id);
  };

  return (
    <div className="pane-item pane-item--hoverable" onClick={onClick}>
      <div
        ref={iconDivRef}
        className="pane-item__squared-rounded-icon"
        onClick={() => props.bpmnDocumentModel.selection.selectElement(props.flowId)}
      >
        <span className="pane-item__options-icon pane-item__options-icon--no-hover pane-item__options-icon--success">
          <Icon id="ph ph-dot-outline" />
        </span>
      </div>
      <div className="pane-item__text">{props.label || props.id}</div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}

export function ConditionalFlowLink(props: ConditionalFlowLinkProps): React.JSX.Element {
  const Icon = props.iconComponent;
  const iconDivRef = useRef<HTMLDivElement | null>(null);

  const conditionIsMissing = props.condition == null || props.condition.trim() === '';
  const showMissingConditionWarning = conditionIsMissing && !props.ignoreMissingCondition;

  const onClick = (event: React.MouseEvent): void => {
    if (event.target === iconDivRef.current || iconDivRef.current?.contains(event.target as Node)) {
      event.stopPropagation();
      return;
    }

    props.bpmnDocumentModel.selection.selectElement(props.id);
  };

  return (
    <div className="pane-item pane-item--hoverable" onClick={onClick}>
      <div
        ref={iconDivRef}
        className="pane-item__squared-rounded-icon"
        data-bs-title={showMissingConditionWarning ? 'Missing condition' : undefined}
        data-bs-toggle="tooltip"
        onClick={() => props.bpmnDocumentModel.selection.selectElement(props.flowId)}
      >
        <span
          className={`pane-item__options-icon pane-item__options-icon--no-hover ${
            showMissingConditionWarning ? 'pane-item__options-icon--warning' : 'pane-item__options-icon--success'
          }`}
        >
          <Icon id={showMissingConditionWarning ? 'ph ph-warning' : 'ph ph-dot-outline'} />
        </span>
      </div>
      <div className="pane-item__text">
        {props.label || props.id}
        <div className="pane-item__sublabel">{props.condition}</div>
      </div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}

export function DefaultFlowLink(props: FlowLinkProps): React.JSX.Element {
  const Icon = props.iconComponent;
  const iconDivRef = useRef<HTMLDivElement | null>(null);

  const onClick = (event: React.MouseEvent): void => {
    if (event.target === iconDivRef.current || iconDivRef.current?.contains(event.target as Node)) {
      event.stopPropagation();
      return;
    }

    props.bpmnDocumentModel.selection.selectElement(props.id);
  };

  return (
    <div className="pane-item pane-item--hoverable" onClick={onClick}>
      <div
        ref={iconDivRef}
        className="pane-item__squared-rounded-icon"
        onClick={() => props.bpmnDocumentModel.selection.selectElement(props.flowId)}
      >
        <span className={`pane-item__options-icon pane-item__options-icon--no-hover pane-item__options-icon--success`}>
          <Icon id="ph ph-dot-outline" />
        </span>
      </div>
      <div className="pane-item__text">
        {props.label || props.id}
        <div className="pane-item__sublabel">
          <span className="exclusive_gateway__default-flow--label">Default Flow</span>
        </div>
      </div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}
