import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { DataInputAssociation } from '../../libs';
import { PlainSequenceFlowLink } from '../FlowNodeInstanceLinks';
import { shouldDisplayDataInputAssociationInfoPane } from '../ShouldBeDisplayedConditions';

export type DataInputAssociationPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayDataInputAssociationInfoPane,
  Pane: PaneFull,
  PaneContent: DataInputAssociationPane,
};

function getPaneTitle(): string {
  return 'Data Input Association';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <DataInputAssociationPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function DataInputAssociationPane(props: DataInputAssociationPaneProps): React.JSX.Element | null {
  const association = props.model.selectedElements[0] as DataInputAssociation;

  return (
    <PaneBody>
      <PaneProperty type="text" label="Association ID" disabled={true} value={association.id} />
      {association.associationModel != null ? (
        <DataInputAssociationLinks model={props.model} association={association} studio={props.studio} />
      ) : (
        <DataInputAssociationNotPartOfExecutedProcessHint />
      )}
    </PaneBody>
  );
}

type AssociationLinksProps = {
  model: EngineBpmnDebuggerEditorDocumentModel;
  association: DataInputAssociation;
  studio: Bifrost;
};

function DataInputAssociationNotPartOfExecutedProcessHint(): React.JSX.Element {
  return <p>This Association is not part of the executed process.</p>;
}

function DataInputAssociationLinks(props: AssociationLinksProps): React.JSX.Element {
  const sourceReference = props.association.source;
  const targetFlowNode = props.association.target;

  let sourceLabel = 'Source Data Object';
  if (
    sourceReference != null &&
    props.model.processModel?.dataStoreReferences.some((reference) => reference.id === sourceReference.id)
  ) {
    sourceLabel = 'Source Data Store';
  }

  return (
    <>
      {sourceReference != null ? (
        <div className="mb-2">
          <div className="flow-node-props__information-header">
            <span className="flow-node-props__information-header--text">{sourceLabel}</span>
          </div>
          <div>
            <PlainSequenceFlowLink
              key={`data_input_association_source_link_${props.association.id}_${sourceReference.id}`}
              targetFlowNodeId={sourceReference.id}
              targetFlowNodeName={sourceReference.name ?? sourceReference.id}
              targetFlowNodeType="bpmn:DataObjectReference"
              iconComponent={Icon}
              sequenceFlowId={props.association.id}
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
              key={`data_input_association_target_link_${props.association.id}_${targetFlowNode.id}`}
              targetFlowNodeId={targetFlowNode.id}
              targetFlowNodeName={targetFlowNode.name ?? targetFlowNode.id}
              targetFlowNodeType={targetFlowNode.type}
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
