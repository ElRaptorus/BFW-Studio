import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { DataOutputAssociation } from '../../libs';
import { PlainSequenceFlowLink } from '../FlowNodeInstanceLinks';
import { shouldDisplayDataOutputAssociationInfoPane } from '../ShouldBeDisplayedConditions';

export type DataOutputAssociationPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayDataOutputAssociationInfoPane,
  Pane: PaneFull,
  PaneContent: DataOutputAssociationPane,
};

function getPaneTitle(): string {
  return 'Data Output Association';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={'bpmn/properties/data_output_association'} />
      </PaneHeader>
      {props.collapsed !== true && <DataOutputAssociationPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function DataOutputAssociationPane(props: DataOutputAssociationPaneProps): React.JSX.Element | null {
  const association = props.model.selectedElements[0] as DataOutputAssociation;

  return (
    <PaneBody>
      <PaneProperty type="text" label="Association ID" disabled={true} value={association.id} />
      {association.associationModel != null ? (
        <DataOutputAssociationProperties
          editorDocument={props.editorDocument}
          model={props.model}
          association={association}
          studio={props.studio}
        />
      ) : (
        <DataOutputAssociationNotPartOfExecutedProcessHint />
      )}
    </PaneBody>
  );
}

type AssociationLinksProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  association: DataOutputAssociation;
  studio: Bifrost;
};

function DataOutputAssociationNotPartOfExecutedProcessHint(): React.JSX.Element {
  return <p>This Association is not part of the executed process.</p>;
}

function DataOutputAssociationProperties(props: AssociationLinksProps): React.JSX.Element {
  const associationModel = props.association.associationModel;
  const sourceFlowNode = props.association.source;
  const targetReference = props.association.target;
  const valueExpression = associationModel?.valueExpression ?? '';

  let targetLabel = 'Target Data Object';
  if (
    targetReference != null &&
    props.model.processModel?.dataStoreReferences.some((reference) => reference.id === targetReference.id)
  ) {
    targetLabel = 'Target Data Store';
  }

  return (
    <>
      <div className="mb-2">
        <div className="flow-node-props__information-header">
          <span className="flow-node-props__information-header--text">Transformation</span>
          <div className="flow-node-props__information-header--controls">
            <button
              className="btn btn-sm btn-secondary flow-node-props__information-header--copy-button"
              onClick={() => navigator.clipboard.writeText(valueExpression)}
            >
              Copy
            </button>{' '}
            <OpenInNewTabButton
              studio={props.studio}
              type="engine-debug.json-property"
              parentUri={props.editorDocument.uri}
              fragmentId={`data-output-association-${props.association.id}-data-source`}
              additionalData={{
                flowNodeId: props.association.id,
                propertyName: 'Transformation',
                value: valueExpression,
                scriptLanguage: 'javascript',
              }}
              dataTest="open-data-output-association-data-source-in-new-tab"
            />
            <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/data_output_association_data_source" />
          </div>
        </div>
        <div>
          <MultiLineCodeEditor
            key={props.association.id}
            studio={props.studio}
            htmlId="debugger-data-output-association-data-source"
            size="medium"
            fontSize={12}
            initialValue={valueExpression}
            readOnly={true}
            language="javascript"
          />
        </div>
      </div>
      {sourceFlowNode != null ? (
        <div className="mb-2">
          <div className="flow-node-props__information-header">
            <span className="flow-node-props__information-header--text">Source Flow Node</span>
          </div>
          <div>
            <PlainSequenceFlowLink
              key={`data_output_association_source_link_${props.association.id}_${sourceFlowNode.id}`}
              targetFlowNodeId={sourceFlowNode.id}
              targetFlowNodeName={sourceFlowNode.name ?? sourceFlowNode.id}
              targetFlowNodeType={sourceFlowNode.type}
              iconComponent={Icon}
              sequenceFlowId={props.association.id}
              model={props.model}
            />
          </div>
        </div>
      ) : null}
      {targetReference != null ? (
        <div className="mb-2">
          <div className="flow-node-props__information-header">
            <span className="flow-node-props__information-header--text">{targetLabel}</span>
          </div>
          <div>
            <PlainSequenceFlowLink
              key={`data_output_association_target_link_${props.association.id}_${targetReference.id}`}
              targetFlowNodeId={targetReference.id}
              targetFlowNodeName={targetReference.name ?? targetReference.id}
              targetFlowNodeType="bpmn:DataObjectReference"
              iconComponent={Icon}
              sequenceFlowId={props.association.id}
              model={props.model}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
