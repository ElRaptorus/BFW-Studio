import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { BpmnElementType, Icon, Pane, PaneBody, PaneHeader, assertNotNull } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../BpmnDocumentModel';
import { BPMN_DOCUMENT_TYPE } from '../../index';
import { FlowLink } from '../BpmnElementFlowLink';

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

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Incoming Flows';
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
  const isJoin = incomingFlows.length > 0 && outgoingFlows.length < incomingFlows.length;
  const isMixed = incomingFlows.length > 1 && outgoingFlows.length > 1;

  return (isJoin || isMixed) && incomingFlows.length > 0;
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

  return (
    <PaneBody>
      {incomingFlows.map((flowElement) => {
        const flowSource = bpmnDocumentModel.elements.getById(flowElement.source.id);
        assertNotNull(flowSource, 'flowSource');

        return (
          <FlowLink
            key={`flow_link_${flowSource.id}_${flowElement.id}`}
            id={flowSource.id}
            label={flowSource.name}
            iconComponent={Icon}
            flowId={flowElement.id}
            bpmnDocumentModel={bpmnDocumentModel}
          />
        );
      })}
    </PaneBody>
  );
}
