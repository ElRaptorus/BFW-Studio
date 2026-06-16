import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplaySequentialMultiInstancePane } from '../ShouldBeDisplayedConditions';

export type SequentialMultiInstancePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplaySequentialMultiInstancePane,
  Pane: PaneFull,
  PaneContent: SequentialMultiInstancePane,
};

function getPaneTitle(): string {
  return 'Sequential Multi Instance';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={'bpmn/properties/sequential-multi-instance'} />
      </PaneHeader>
      {props.collapsed !== true && <SequentialMultiInstancePane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function SequentialMultiInstancePane(props: SequentialMultiInstancePaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode;

  return (
    <PaneBody>
      <PaneProperty
        type="text"
        label="Timeout between iterations (Definition)"
        disabled={true}
        value={flowNodeModel.multiInstance?.loopInterval ?? ''}
      />
    </PaneBody>
  );
}
