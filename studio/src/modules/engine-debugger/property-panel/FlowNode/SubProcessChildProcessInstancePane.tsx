import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getChildProcessInstanceId, isAdHocSubprocessFni } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplaySubProcessInstancePane } from '../ShouldBeDisplayedConditions';
import { ChildProcessInstanceLink } from './CallActivityChildProcessInstancePane';

export type SubProcessChildProcessInstancePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplaySubProcessInstancePane,
  Pane: PaneFull,
  PaneContent: SubProcessChildProcessInstancePane,
};

function getPaneTitle(): string {
  return 'Child Process Instance';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/subprocess" />
      </PaneHeader>
      {props.collapsed !== true && <SubProcessChildProcessInstancePane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function SubProcessChildProcessInstancePane(props: SubProcessChildProcessInstancePaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const subProcessInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  const childProcessInstanceId = getChildProcessInstanceId(subProcessInstance);
  const isEventSubprocess =
    (subProcessInstance.typeProperties as Record<string, unknown> | null)?.isEventSubprocess === true;
  const isAdHoc = isAdHocSubprocessFni(subProcessInstance);

  if (!childProcessInstanceId) {
    return <PaneBody>Child Process Instance has not yet started.</PaneBody>;
  }

  return (
    <PaneBody>
      {isEventSubprocess && <span className="badge bg-info text-dark mb-2 d-inline-block">Event Sub-Process</span>}
      {isAdHoc && <span className="badge bg-info text-dark mb-2 d-inline-block">Ad-hoc Sub-Process</span>}
      <ChildProcessInstanceLink
        model={props.model}
        processModelId={flowNode.flowNodeModel?.id}
        processInstanceId={childProcessInstanceId}
        studio={props.studio}
      />
    </PaneBody>
  );
}
