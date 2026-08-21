import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getCorrelationRetrievalExpression } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayCorrelationRetrievalExpressionPane } from '../ShouldBeDisplayedConditions';

export type CorrelationRetrievalExpressionPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayCorrelationRetrievalExpressionPane,
  Pane: PaneFull,
  PaneContent: CorrelationRetrievalExpressionPane,
};

function getPaneTitle(): string {
  return 'Correlation Retrieval Expression';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/correlation_retrieval_expression" />
      </PaneHeader>
      {props.collapsed !== true && <CorrelationRetrievalExpressionPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function CorrelationRetrievalExpressionPane(props: CorrelationRetrievalExpressionPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;
  const expression = getCorrelationRetrievalExpression(flowNodeModel);

  return (
    <PaneBody>
      <PaneProperty
        htmlId="debugger-correlation-retrieval-expression-property"
        type="text"
        label="Expression"
        value={expression}
        disabled={true}
      />
    </PaneBody>
  );
}
