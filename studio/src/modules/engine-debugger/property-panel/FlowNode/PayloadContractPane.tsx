import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import type { FlowNode as BpmnFlowNode } from '@elraptorus/bfw_engine_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getPayloadContract } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayPayloadContractPane } from '../ShouldBeDisplayedConditions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed: shouldDisplayPayloadContractPane,
  Pane: PaneFull,
  PaneContent: PayloadContractPane,
};

function getPaneTitle(): string {
  return 'Payload Contract';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PayloadContractPane {...props} />}
    </Pane>
  );
}

function PayloadContractPane(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;

  const contract = getPayloadContract(flowNodeModel);
  const displayValue = contract != null ? JSON.stringify(contract, null, 2) : '—';

  return (
    <PaneBody>
      <PaneProperty type="textarea" label="Payload Contract" value={displayValue} disabled rows={6} />
    </PaneBody>
  );
}
