import type { IconComponent } from '#bifrost/contracts/IconTypes';

import React, { useRef } from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import { resolveFlowNodeIconForDebugger } from '../libs/flowNodeDisplay';

export type DataObjectInstanceLinkProps = {
  iconComponent: IconComponent;
  model: EngineBpmnDebuggerEditorDocumentModel;
  targetDataObjectId: string;
  targetDataObjectName?: string | null;
  targetDataObjectInstanceId: string;
  sublabel: string;
};

export type FlowNodeInstanceLinkProps = {
  iconComponent: IconComponent;
  model: EngineBpmnDebuggerEditorDocumentModel;
  targetFlowNodeId: string;
  targetFlowNodeName?: string | null;
  targetFlowNodeInstanceId: string;
  targetFlowNodeType: string;
  targetFlowNodeEventType?: string | null;
};

export type SequenceFlowLinkProps = {
  iconComponent: IconComponent;
  model: EngineBpmnDebuggerEditorDocumentModel;
  sequenceFlowId: string;
  targetFlowNodeId: string;
  targetFlowNodeName?: string | null;
  targetFlowNodeType: string;
  targetFlowNodeEventType?: string | null;
};

export type ConditionalSequenceFlowLinkProps = SequenceFlowLinkProps & {
  condition?: string | undefined;
};

export function DataObjectInstanceLink(props: DataObjectInstanceLinkProps): React.JSX.Element {
  const Icon = props.iconComponent;

  const onClick = (event): void => {
    props.model.navigateToDataObjectInstance(props.targetDataObjectInstanceId);
  };
  return (
    <div className="pane-item pane-item--hoverable" onClick={onClick}>
      <div className="pane-item__text">
        {props.targetDataObjectName || props.targetDataObjectId}
        <div className="pane-item__sublabel">{props.sublabel}</div>
      </div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}

export function FlowNodeInstanceLink(props: FlowNodeInstanceLinkProps): React.JSX.Element {
  const Icon = props.iconComponent;

  const onClick = (event): void => {
    props.model.navigateToFlowNodeInstance(props.targetFlowNodeInstanceId);
  };
  return (
    <div className="pane-item pane-item--hoverable" onClick={onClick}>
      <div className="pane-item__squared-rounded-icon" onClick={onClick}>
        <span className={'pane-item__options-icon pane-item__options-icon--no-hover'}>
          <Icon id={resolveFlowNodeIconForDebugger(props.targetFlowNodeType, props.targetFlowNodeEventType)} />
        </span>
      </div>
      <div className="pane-item__text">
        {props.targetFlowNodeName || props.targetFlowNodeId}
        <div className="pane-item__sublabel">{props.targetFlowNodeInstanceId}</div>
      </div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}

export function PlainSequenceFlowLink(props: SequenceFlowLinkProps): React.JSX.Element {
  const Icon = props.iconComponent;
  const iconDivRef = useRef<HTMLDivElement | null>(null);

  const onClick = (event: React.MouseEvent): void => {
    if (event.target === iconDivRef.current || iconDivRef.current?.contains(event.target as Node)) {
      event.stopPropagation();
      return;
    }

    props.model.selectElement(props.targetFlowNodeId);
  };

  return (
    <div className="pane-item pane-item--hoverable" onClick={onClick}>
      <div ref={iconDivRef} className="pane-item__squared-rounded-icon" onClick={onClick}>
        <span className={'pane-item__options-icon pane-item__options-icon--no-hover'}>
          <Icon id={resolveFlowNodeIconForDebugger(props.targetFlowNodeType, props.targetFlowNodeEventType)} />
        </span>
      </div>
      <div className="pane-item__text">{props.targetFlowNodeName || props.targetFlowNodeId}</div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}

export function DefaultSequenceFlowLink(props: SequenceFlowLinkProps): React.JSX.Element {
  const Icon = props.iconComponent;
  const iconDivRef = useRef<HTMLDivElement | null>(null);

  const onClick = (event: React.MouseEvent): void => {
    if (event.target === iconDivRef.current || iconDivRef.current?.contains(event.target as Node)) {
      event.stopPropagation();
      return;
    }

    props.model.selectElement(props.targetFlowNodeId);
  };

  return (
    <div className="pane-item pane-item--hoverable" onClick={onClick}>
      <div
        ref={iconDivRef}
        className="pane-item__squared-rounded-icon"
        onClick={() => props.model.selectElement(props.sequenceFlowId)}
      >
        <span className={'pane-item__options-icon pane-item__options-icon--no-hover'}>
          <Icon id={resolveFlowNodeIconForDebugger(props.targetFlowNodeType, props.targetFlowNodeEventType)} />
        </span>
      </div>
      <div className="pane-item__text">
        {props.targetFlowNodeName || props.targetFlowNodeId}
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

export function ConditionalSequenceFlowLink(props: ConditionalSequenceFlowLinkProps): React.JSX.Element {
  const Icon = props.iconComponent;
  const iconDivRef = useRef<HTMLDivElement | null>(null);

  const conditionIsMissing = props.condition == null || props.condition.trim() === '';

  const onClick = (event: React.MouseEvent): void => {
    if (event.target === iconDivRef.current || iconDivRef.current?.contains(event.target as Node)) {
      event.stopPropagation();
      return;
    }

    props.model.selectElement(props.targetFlowNodeId);
  };

  return (
    <div className="pane-item pane-item--hoverable" onClick={onClick}>
      <div
        ref={iconDivRef}
        className="pane-item__squared-rounded-icon"
        data-bs-title={conditionIsMissing ? 'Missing condition' : undefined}
        data-bs-toggle="tooltip"
        onClick={() => props.model.selectElement(props.targetFlowNodeId)}
      >
        {conditionIsMissing && (
          <span
            className={'pane-item__options-icon pane-item__options-icon--no-hover pane-item__options-icon--warning'}
          >
            <Icon id="ph ph-warning" />
          </span>
        )}
        <span className={'pane-item__options-icon pane-item__options-icon--no-hover'}>
          <Icon id={resolveFlowNodeIconForDebugger(props.targetFlowNodeType, props.targetFlowNodeEventType)} />
        </span>
      </div>
      <div className="pane-item__text">
        {props.targetFlowNodeName || props.targetFlowNodeId}
        <div className="pane-item__sublabel">{props.condition}</div>
      </div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}
