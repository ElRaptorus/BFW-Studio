import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import {
  Icon,
  MultiLineCodeEditor,
  OpenInNewTabButton,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
} from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { SequenceFlow } from '../../libs';
import { getAllSequenceFlows } from '../../libs/BpmnProcessHelpers';
import { getConditionExpressionText } from '../../libs/typeHelpers';
import { PlainSequenceFlowLink } from '../FlowNodeInstanceLinks';
import { shouldDisplaySequenceFlowInfoPane } from '../ShouldBeDisplayedConditions';

export type SequenceFlowPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplaySequenceFlowInfoPane,
  Pane: PaneFull,
  PaneContent: SequenceFlowPane,
};

function getPaneTitle(): string {
  return 'Sequence Flow';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={'bpmn/properties/sequence_flow'} />
      </PaneHeader>
      {props.collapsed !== true && <SequenceFlowPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function SequenceFlowPane(props: SequenceFlowPaneProps): React.JSX.Element | null {
  const sequenceFlow = props.model.selectedElements[0] as SequenceFlow;
  const processModel = props.model.processModel;

  const sequenceFlowBelongsToExecutedProcess =
    processModel != null && getAllSequenceFlows(processModel).some((flow) => flow.id === sequenceFlow.id);

  return (
    <PaneBody>
      <PaneProperty type="text" label="Sequence Flow ID" disabled={true} value={sequenceFlow.id} />
      <PaneProperty type="text" label="Sequence Flow Name" disabled={true} value={sequenceFlow.name || ''} />
      {sequenceFlowBelongsToExecutedProcess &&
        getConditionExpressionText(sequenceFlow.sequenceFlowModel?.conditionExpression) != null && (
          <SequenceFlowCondition {...props} />
        )}
      {sequenceFlowBelongsToExecutedProcess ? (
        <SequenceFlowLinks model={props.model} sequenceFlow={sequenceFlow} studio={props.studio} />
      ) : (
        <SequenceFlowNotPartOfExecutedProcessHint />
      )}
    </PaneBody>
  );
}

type SequenceFlowLinksProps = {
  model: EngineBpmnDebuggerEditorDocumentModel;
  sequenceFlow: SequenceFlow;
  studio: Studio;
};

function SequenceFlowNotPartOfExecutedProcessHint(props: any): React.JSX.Element {
  return <p>This Flow is not part of the executed process.</p>;
}

function SequenceFlowCondition(props: SequenceFlowPaneProps): React.JSX.Element {
  const sequenceFlow = props.model.selectedElements[0] as SequenceFlow;
  const conditionText = getConditionExpressionText(sequenceFlow.sequenceFlowModel?.conditionExpression) ?? '';

  return (
    <div className="mb-2">
      <div className="flow-node-props__information-header">
        <span className="flow-node-props__information-header--text">Condition</span>
        <div className="flow-node-props__information-header--controls">
          <button
            className="btn btn-sm btn-secondary flow-node-props__information-header--copy-button"
            onClick={() => navigator.clipboard.writeText(conditionText)}
          >
            Copy
          </button>{' '}
          <OpenInNewTabButton
            studio={props.studio}
            type="engine-debug.json-property"
            parentUri={props.editorDocument.uri}
            fragmentId={`data-output-association-${sequenceFlow.id}-data-source`}
            additionalData={{
              flowNodeId: sequenceFlow.id,
              propertyName: 'Condition',
              value: conditionText,
              scriptLanguage: 'javascript',
            }}
            dataTest="open-sequence-flow-condition-in-new-tab"
          />
        </div>
      </div>
      <div>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="debugger-sequence-flow-condition"
          size="small"
          fontSize={12}
          initialValue={conditionText}
          readOnly={true}
          language="javascript"
        />
      </div>
    </div>
  );
}

function SequenceFlowLinks(props: SequenceFlowLinksProps): React.JSX.Element {
  const sourceFlowNode = props.sequenceFlow.sourceFlowNode;
  const targetFlowNode = props.sequenceFlow.targetFlowNode;

  return (
    <>
      {sourceFlowNode != null ? (
        <div className="mb-2">
          <div className="flow-node-props__information-header">
            <span className="flow-node-props__information-header--text">Source Flow Node</span>
          </div>
          <div>
            <PlainSequenceFlowLink
              key={`sequence_flow_source_link_${props.sequenceFlow.id}_${sourceFlowNode.id}`}
              targetFlowNodeId={sourceFlowNode.id}
              targetFlowNodeName={sourceFlowNode.name ?? sourceFlowNode.id}
              targetFlowNodeType={sourceFlowNode.type}
              iconComponent={Icon}
              sequenceFlowId={props.sequenceFlow.id}
              model={props.model}
            />
          </div>
        </div>
      ) : null}
      {targetFlowNode != null ? (
        <div className="mb-2">
          <div className="flow-node-props__information-header">
            <span className="flow-node-props__information-header--text">Target Flow Node</span>
          </div>
          <div>
            <PlainSequenceFlowLink
              key={`sequence_flow_target_link_${props.sequenceFlow.id}_${targetFlowNode.id}`}
              targetFlowNodeId={targetFlowNode.id}
              targetFlowNodeName={targetFlowNode.name ?? targetFlowNode.id}
              targetFlowNodeType={targetFlowNode.type}
              iconComponent={Icon}
              sequenceFlowId={props.sequenceFlow.id}
              model={props.model}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
