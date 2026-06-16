import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getCallActivityCalledElement } from '../../libs/BpmnFlowNodeAccessors';
import { getChildProcessInstanceId } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayCallActivityInstancePane } from '../ShouldBeDisplayedConditions';

export type CallActivityChildProcessInstancePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayCallActivityInstancePane,
  Pane: PaneFull,
  PaneContent: CallActivityChildProcessInstancePane,
};

function getPaneTitle(): string {
  return 'Child Process Instance';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/call_activity" />
      </PaneHeader>
      {props.collapsed !== true && (
        <CallActivityChildProcessInstancePane {...props} model={props.editorDocumentModel} />
      )}
    </Pane>
  );
}

function CallActivityChildProcessInstancePane(props: CallActivityChildProcessInstancePaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const callActivityModel = flowNode.flowNodeModel as BpmnFlowNode;
  const callActivityInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  const childProcessInstanceId = getChildProcessInstanceId(callActivityInstance);

  if (!childProcessInstanceId) {
    return <PaneBody>Child Process Instance has not yet started.</PaneBody>;
  }

  const targetProcessModelId = getCallActivityCalledElement(callActivityModel);

  return (
    <PaneBody>
      <ChildProcessInstanceLink
        model={props.model}
        processInstanceId={childProcessInstanceId}
        processModelId={targetProcessModelId}
        studio={props.studio}
      />
    </PaneBody>
  );
}

type ChildProcessInstanceLinkProps = {
  processModelId?: string;
  processInstanceId: string;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export function ChildProcessInstanceLink(props: ChildProcessInstanceLinkProps): React.JSX.Element {
  const cmd = props.studio.commands.getClickHandler();

  const label = props.processModelId ?? props.processInstanceId;
  const sublabel = props.processModelId ? props.processInstanceId : '';

  return (
    <div
      className="pane-item pane-item--hoverable"
      title="Open Child Process Instance in new tab"
      data-bs-toggle="tooltip"
      onClick={cmd('engine.debugger.focusOrOpen', [props.model.engineUrl, props.processInstanceId])}
    >
      <div className="pane-item__text">
        {label}
        <div className="pane-item__sublabel">{sublabel}</div>
      </div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}
