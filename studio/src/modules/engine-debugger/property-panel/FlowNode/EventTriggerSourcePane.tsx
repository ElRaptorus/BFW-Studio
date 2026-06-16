import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { resolveFlowNodeIconForDebugger } from '../../libs/flowNodeDisplay';
import { shouldDisplayEventTriggerSourcePane } from '../ShouldBeDisplayedConditions';

type EventTriggerSourcePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayEventTriggerSourcePane,
  Pane: PaneFull,
  PaneContent: EventTriggerSourcePane,
};

function getPaneTitle(): string {
  return 'Event Source';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && (
        <EventTriggerSourcePane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function EventTriggerSourcePane(props: EventTriggerSourcePaneProps): React.JSX.Element | null {
  const selectedFlowNodeInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(props.flowNode);
  const triggererId = selectedFlowNodeInstance.triggererFlowNodeInstanceId;
  if (!triggererId) {
    return null;
  }

  const targetFlowNodeInstance = props.model.flowNodeInstances.find((instance) => instance.id === triggererId);
  if (!targetFlowNodeInstance) {
    return null;
  }

  const onClick = (): void => {
    props.studio.commands.executeCommand('engine.debugger.focusOrOpen', [
      props.model.engineId,
      targetFlowNodeInstance.processInstanceId,
      targetFlowNodeInstance.id,
    ]);
  };

  return (
    <PaneBody>
      <div className="pane-item pane-item--hoverable" onClick={onClick}>
        <div className="pane-item__squared-rounded-icon" onClick={onClick}>
          <span className={'pane-item__options-icon pane-item__options-icon--no-hover'}>
            <Icon
              id={resolveFlowNodeIconForDebugger(targetFlowNodeInstance.flowNodeType, targetFlowNodeInstance.eventType)}
            />
          </span>
        </div>
        <div className="pane-item__text">
          {targetFlowNodeInstance.flowNodeId}
          <div className="pane-item__sublabel">{targetFlowNodeInstance.id}</div>
        </div>
        <div className="pane-item__options">
          <Icon id="ph ph-caret-right" />
        </div>
      </div>
    </PaneBody>
  );
}
