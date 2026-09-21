import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import type { FlowNode as BpmnFlowNode } from '@elraptorus/bfw_engine_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

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

function UntypedTaskPane(props: PaneComponentProps): React.JSX.Element {
  const model: EngineBpmnDebuggerEditorDocumentModel | null = props.editorDocumentModel;
  assertNotNull(model, 'model');

  const untypedTask = model.selectedElements[0] as FlowNode;

  const untypedTaskModel = untypedTask.flowNodeModel as BpmnFlowNode;

  return (
    <PaneBody key={untypedTaskModel.id}>
      <PaneProperty type="text" label="Enabled" disabled={true} value={`${''}`} />
    </PaneBody>
  );
}
