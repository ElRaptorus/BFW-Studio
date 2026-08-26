import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayManualTaskInstancePane } from '../ShouldBeDisplayedConditions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayManualTaskInstancePane,
  Pane: PaneFull,
  PaneContent: ManualTaskPane,
};

function getPaneTitle(): string {
  return 'Requires Confirmation';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/manual_task_requires_confirmation" />
      </PaneHeader>
      {props.collapsed !== true && <ManualTaskPane {...props} />}
    </Pane>
  );
}

function ManualTaskPane(props: PaneComponentProps): React.JSX.Element {
  const model: EngineBpmnDebuggerEditorDocumentModel | null = props.editorDocumentModel;
  assertNotNull(model, 'model');

  const manualTask = model.selectedElements[0] as FlowNode;
  const manualTaskModel = manualTask.flowNodeModel as BpmnFlowNode;
  const requireConfirmation =
    manualTaskModel.typeData.type === 'manual_task' ? manualTaskModel.typeData.requireConfirmation : false;

  return (
    <PaneBody key={manualTask.id}>
      <PaneProperty type="text" label="Enabled" disabled={true} value={`${requireConfirmation}`} />
    </PaneBody>
  );
}
