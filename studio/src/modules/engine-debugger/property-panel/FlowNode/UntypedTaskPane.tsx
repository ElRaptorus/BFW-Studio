import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayUntypedTaskInstancePane } from '../ShouldBeDisplayedConditions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayUntypedTaskInstancePane,
  Pane: PaneFull,
  PaneContent: UntypedTaskPane,
};

function getPaneTitle(): string {
  return 'Breakpoint';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/untyped_task_breakpoint" />
      </PaneHeader>
      {props.collapsed !== true && <UntypedTaskPane {...props} />}
    </Pane>
  );
}

function UntypedTaskPane(props: PaneComponentProps): React.JSX.Element | null {
  const model: EngineBpmnDebuggerEditorDocumentModel | null = props.editorDocumentModel;
  if (model == null) {
    return null;
  }

  const untypedTask = model.selectedElements[0] as FlowNode;

  const untypedTaskModel = untypedTask.flowNodeModel as BpmnFlowNode;

  return (
    <PaneBody key={untypedTaskModel.id}>
      <PaneProperty type="text" label="Enabled" disabled={true} value={`${''}`} />
    </PaneBody>
  );
}
