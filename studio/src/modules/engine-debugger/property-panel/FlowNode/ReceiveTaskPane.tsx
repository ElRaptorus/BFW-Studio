import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getMessageReference } from '../../libs/BpmnFlowNodeAccessors';
import { resolveMessageName } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayReceiveTaskInstancePane } from '../ShouldBeDisplayedConditions';

type ReceiveTaskPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayReceiveTaskInstancePane,
  Pane: PaneFull,
  PaneContent: ReceiveTaskPane,
};

function getPaneTitle(): string {
  return 'Receive Task';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const selectedElement = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/receive_task" />
      </PaneHeader>
      {props.collapsed !== true && (
        <ReceiveTaskPane
          editorDocument={props.editorDocument}
          flowNode={selectedElement}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function ReceiveTaskPane(props: ReceiveTaskPaneProps): React.JSX.Element {
  const receiveTask = props.flowNode.flowNodeModel as BpmnFlowNode;
  const messageRef = getMessageReference(receiveTask);
  const messageName =
    props.model.processDefinition && messageRef
      ? resolveMessageName(props.model.processDefinition, messageRef)
      : messageRef;

  return (
    <PaneBody>
      <PaneProperty type="text" label="Message Name" disabled={true} value={messageName ?? ''} />
    </PaneBody>
  );
}
