import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayCallActivityInstancePane } from '../ShouldBeDisplayedConditions';

export type CallActivityPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayCallActivityInstancePane,
  Pane: PaneFull,
  PaneContent: CallActivityPane,
};

function getPaneTitle(): string {
  return 'Call Activity Definition';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/call_activity" />
      </PaneHeader>
      {props.collapsed !== true && <CallActivityPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function CallActivityPane(props: CallActivityPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const callActivityModel = flowNode.flowNodeModel as BpmnFlowNode;

  return (
    <PaneBody>
      {/* TODO - Cannot insert a "Jump to Element" Link here, because we don't know the targets Process Definition ID */}
      <PaneProperty
        type="text"
        label="Target Process Model"
        disabled={true}
        value={
          (callActivityModel.typeData.type === 'call_activity' ? callActivityModel.typeData.calledElement : '') ?? ''
        }
      />
      <PaneProperty
        type="text"
        label="Start Event ID"
        disabled={true}
        value={
          (callActivityModel.typeData.type === 'call_activity' ? callActivityModel.typeData.startEventId : '') ?? ''
        }
      />
    </PaneBody>
  );
}
