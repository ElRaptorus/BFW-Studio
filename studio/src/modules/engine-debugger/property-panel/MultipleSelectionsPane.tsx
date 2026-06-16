import { EventDefinitionType } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React, { useRef } from 'react';

import type { IconComponent, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import { getEventDefinition } from '../libs/BpmnProcessHelpers';
import { resolveFlowNodeIconForDebugger } from '../libs/flowNodeDisplay';
import { shouldDisplayMultipleSelectionsPane } from './ShouldBeDisplayedConditions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayMultipleSelectionsPane,
  Pane: PaneFull,
  PaneContent: MultipleSelectionsPane,
};

function getPaneTitle(): string {
  return 'Selected Elements';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <MultipleSelectionsPane {...props} />}
    </Pane>
  );
}

function MultipleSelectionsPane(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const selectedElements = model.selectedElements;
  if (selectedElements == null || selectedElements.length <= 1) {
    return null;
  }

  return (
    <PaneBody>
      {selectedElements.map((selection) => {
        return (
          <SelectedElementLink
            key={`selected_element_link_${selection.id}`}
            iconComponent={Icon}
            model={model}
            name={selection.name}
            id={selection.id}
            targetElementType={selection.shapeType}
            targetElementEventType={selection.type === 'FlowNode' ? getEventType(selection.flowNodeModel) : undefined}
          />
        );
      })}
    </PaneBody>
  );
}

type SelectedElementLinkProps = {
  iconComponent: IconComponent;
  model: EngineBpmnDebuggerEditorDocumentModel;
  id: string;
  name?: string;
  targetElementType: string;
  targetElementEventType?: string;
};

function SelectedElementLink(props: SelectedElementLinkProps): React.JSX.Element {
  const Icon = props.iconComponent;
  const iconDivRef = useRef<HTMLDivElement | null>(null);

  const onClick = (event: React.MouseEvent): void => {
    if (event.target === iconDivRef.current || iconDivRef.current?.contains(event.target as Node)) {
      event.stopPropagation();
      return;
    }

    props.model.selectElement(props.id);
  };

  return (
    <div className="pane-item pane-item--hoverable" onClick={onClick}>
      <div ref={iconDivRef} className="pane-item__squared-rounded-icon" onClick={onClick}>
        <span className={'pane-item__options-icon pane-item__options-icon--no-hover'}>
          <Icon id={resolveFlowNodeIconForDebugger(props.targetElementType, props.targetElementEventType)} />
        </span>
      </div>
      <div className="pane-item__text">
        {props.id}
        <div className="pane-item__sublabel">{props.name}</div>
      </div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}

function getEventType(flowNode: BpmnFlowNode | undefined): string {
  const eventDefinition = flowNode ? getEventDefinition(flowNode) : null;
  if (!eventDefinition) {
    return '';
  }
  switch (eventDefinition.type) {
    case 'error':
      return EventDefinitionType.Error;
    case 'link':
      return EventDefinitionType.Link;
    case 'message':
      return EventDefinitionType.Message;
    case 'signal':
      return EventDefinitionType.Signal;
    case 'terminate':
      return EventDefinitionType.Terminate;
    case 'timer':
      return EventDefinitionType.Timer;
    default:
      return '';
  }
}
