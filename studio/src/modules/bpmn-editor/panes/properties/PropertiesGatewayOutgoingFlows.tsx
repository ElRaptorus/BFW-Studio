import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import type { BpmnElement_ConditionalFlow } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import type BpmnDocumentModel from '../../BpmnDocumentModel';
import { BPMN_DOCUMENT_TYPE } from '../../index';
import { ConditionalFlowLink, DefaultFlowLink, FlowLink } from '../BpmnElementFlowLink';
import { assertBpmnElementIsConditionalOrDefaultFlow } from '../BpmnElementTypeAssertionFunctions';

const GATEWAY_TYPES: Set<string> = new Set([
  BpmnElementType.ExclusiveGateway,
  BpmnElementType.ParallelGateway,
  BpmnElementType.InclusiveGateway,
  BpmnElementType.ComplexGateway,
  BpmnElementType.EventBasedGateway,
]);

const SEQUENCE_FLOW_TYPES: Set<string> = new Set([
  BpmnElementType.DefaultFlow,
  BpmnElementType.ConditionalFlow,
  BpmnElementType.SequenceFlow,
]);

const GATEWAYS_WITH_CONDITIONAL_OUTGOING: Set<string> = new Set([
  BpmnElementType.ExclusiveGateway,
  BpmnElementType.ComplexGateway,
]);

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Outgoing Flows';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument?.documentType !== BPMN_DOCUMENT_TYPE) {
    return false;
  }

  const bpmnModel = editorDocumentModel as BpmnDocumentModel;
  const selectedElements = bpmnModel?.selection?.getElements();
  if (selectedElements?.length !== 1) {
    return false;
  }

  const element = selectedElements[0];
  if (!GATEWAY_TYPES.has(element?.type)) {
    return false;
  }

  const incomingFlows = element.incomingFlows.filter((flow) => SEQUENCE_FLOW_TYPES.has(flow.type));
  const outgoingFlows = element.outgoingFlows.filter((flow) => SEQUENCE_FLOW_TYPES.has(flow.type));
  const isSplit = outgoingFlows.length > 0 && outgoingFlows.length > incomingFlows.length;
  const isMixed = incomingFlows.length > 1 && outgoingFlows.length > 1;

  return (isSplit || isMixed) && outgoingFlows.length > 0;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const incomingFlows = element.incomingFlows.filter((flow) => SEQUENCE_FLOW_TYPES.has(flow.type));
  const outgoingFlows = element.outgoingFlows.filter((flow) => SEQUENCE_FLOW_TYPES.has(flow.type));
  const isMixed = incomingFlows.length > 1 && outgoingFlows.length > 1;
  const useConditionalOutgoing = GATEWAYS_WITH_CONDITIONAL_OUTGOING.has(element.type);

  return (
    <PaneBody>
      {useConditionalOutgoing
        ? outgoingFlows.map((flowElement) => {
            const conditionalFlow = bpmnDocumentModel.elements.getById(flowElement.id);
            assertBpmnElementIsConditionalOrDefaultFlow(conditionalFlow);
            const flowTarget = bpmnDocumentModel.elements.getById(flowElement.target.id);
            assertNotNull(flowTarget, 'flowTarget');

            return flowElement.type === BpmnElementType.DefaultFlow ? (
              <DefaultFlowLink
                key={`default_flow_link_${flowTarget.id}_${flowElement.id}`}
                id={flowTarget.id}
                label={flowTarget.name}
                iconComponent={Icon}
                flowId={flowElement.id}
                bpmnDocumentModel={bpmnDocumentModel}
              />
            ) : (
              <ConditionalFlowLink
                key={`conditional_flow_link_${flowTarget.id}_${flowElement.id}`}
                id={flowTarget.id}
                label={flowTarget.name}
                condition={(conditionalFlow as BpmnElement_ConditionalFlow).condition}
                ignoreMissingCondition={isMixed}
                iconComponent={Icon}
                flowId={flowElement.id}
                bpmnDocumentModel={bpmnDocumentModel}
              />
            );
          })
        : outgoingFlows.map((flowElement) => {
            const flowTarget = bpmnDocumentModel.elements.getById(flowElement.target.id);
            assertNotNull(flowTarget, 'flowTarget');

            return (
              <FlowLink
                key={`flow_link_${flowTarget.id}_${flowElement.id}`}
                id={flowTarget.id}
                label={flowTarget.name}
                iconComponent={Icon}
                flowId={flowElement.id}
                bpmnDocumentModel={bpmnDocumentModel}
              />
            );
          })}
    </PaneBody>
  );
}
