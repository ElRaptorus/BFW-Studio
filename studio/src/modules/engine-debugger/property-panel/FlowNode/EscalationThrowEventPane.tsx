import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getEscalationCode } from '../../libs/BpmnFlowNodeAccessors';
import { getEventDefinition, resolveEscalationName } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayEscalationThrowEventPane } from '../ShouldBeDisplayedConditions';

type EscalationEventPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayEscalationThrowEventPane,
  Pane: PaneFull,
  PaneContent: EscalationThrowEventPane,
};

function getPaneTitle(): string {
  return 'Escalation Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && (
        <EscalationThrowEventPane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function EscalationThrowEventPane(props: EscalationEventPaneProps): React.JSX.Element {
  const escalationEvent = props.flowNode.flowNodeModel as BpmnFlowNode;
  const escalationCode = getEscalationCode(escalationEvent);
  const eventDefinition = getEventDefinition(escalationEvent);
  const escalationName =
    props.model.processDefinition && eventDefinition?.type === 'escalation'
      ? resolveEscalationName(props.model.processDefinition, eventDefinition.escalationRef)
      : null;

  return (
    <PaneBody>
      <PaneProperty type="text" label="Escalation Code" disabled={true} value={escalationCode} />
      <PaneProperty type="text" label="Escalation Name" disabled={true} value={escalationName ?? ''} />
    </PaneBody>
  );
}
