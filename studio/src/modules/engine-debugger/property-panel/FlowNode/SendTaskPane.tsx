import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getMessageReference } from '../../libs/BpmnFlowNodeAccessors';
import { resolveMessageName } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/index';
import { shouldDisplaySendTaskInstancePane } from '../ShouldBeDisplayedConditions';

type SendTaskPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplaySendTaskInstancePane,
  Pane: PaneFull,
  PaneContent: SendTaskPane,
};

function getPaneTitle(): string {
  return 'Send Task';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const selectedElement = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/send_task" />
      </PaneHeader>
      {props.collapsed !== true && (
        <SendTaskPane
          editorDocument={props.editorDocument}
          flowNode={selectedElement}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function SendTaskPane(props: SendTaskPaneProps): React.JSX.Element {
  const sendTask = props.flowNode.flowNodeModel as BpmnFlowNode;
  const messageRef = getMessageReference(sendTask);
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
