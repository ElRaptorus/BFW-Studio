import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import type { FlowNode as BpmnFlowNode } from '@elraptorus/bfw_engine_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getEscalationCode } from '../../libs/BpmnFlowNodeAccessors';
import { getEventDefinition, resolveEscalationCode, resolveEscalationName } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayEscalationBoundaryEventPane } from '../ShouldBeDisplayedConditions';

type EscalationEventPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayEscalationBoundaryEventPane,
  Pane: PaneFull,
  PaneContent: EscalationBoundaryEventPane,
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
        <EscalationBoundaryEventPane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function EscalationBoundaryEventPane(props: EscalationEventPaneProps): React.JSX.Element {
  const escalationEvent = props.flowNode.flowNodeModel as BpmnFlowNode;
  const eventDefinition = getEventDefinition(escalationEvent);
  const escalationRef = eventDefinition?.type === 'escalation' ? eventDefinition.escalationRef : null;
  const resolvedCode = props.model.processDefinition
    ? resolveEscalationCode(props.model.processDefinition, escalationRef)
    : null;
  const escalationCode = resolvedCode || getEscalationCode(escalationEvent);
  const escalationName =
    props.model.processDefinition && eventDefinition?.type === 'escalation'
      ? resolveEscalationName(props.model.processDefinition, eventDefinition.escalationRef)
      : null;

  if (!escalationCode && !escalationName) {
    return (
      <PaneBody>
        <p>Catches all Escalations</p>
      </PaneBody>
    );
  }

  return (
    <PaneBody>
      <p>Catches specific Escalation</p>
      <PaneProperty type="text" label="Escalation Code" disabled={true} value={escalationCode} />
      <PaneProperty type="text" label="Escalation Name" disabled={true} value={escalationName ?? ''} />
    </PaneBody>
  );
}
