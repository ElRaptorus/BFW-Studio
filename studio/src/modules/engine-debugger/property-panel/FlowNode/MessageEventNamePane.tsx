import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getMessageReference } from '../../libs/BpmnFlowNodeAccessors';
import { resolveMessageName } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayMessageEventPane } from '../ShouldBeDisplayedConditions';

type MessageEventNamePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayMessageEventPane,
  Pane: PaneFull,
  PaneContent: MessageEventNamePane,
};

function getPaneTitle(): string {
  return 'Message Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && (
        <MessageEventNamePane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function MessageEventNamePane(props: MessageEventNamePaneProps): React.JSX.Element {
  const messageEvent = props.flowNode.flowNodeModel as BpmnFlowNode | undefined;
  const messageRef = getMessageReference(messageEvent);
  const messageName =
    props.model.processDefinition != null
      ? (resolveMessageName(props.model.processDefinition, messageRef) ?? messageRef ?? '')
      : (messageRef ?? '');

  return (
    <PaneBody>
      <PaneProperty type="text" label="Message Name" disabled={true} value={messageName} />
      <PaneProperty type="text" label="Message Reference" disabled={true} value={messageRef} />
    </PaneBody>
  );
}
