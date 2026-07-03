import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getChildProcessInstanceId } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplaySubProcessInstancePane } from '../ShouldBeDisplayedConditions';
import { ChildProcessInstanceLink } from './CallActivityChildProcessInstancePane';

export type SubProcessChildProcessInstancePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
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

  if (!childProcessInstanceId) {
    return <PaneBody>Child Process Instance has not yet started.</PaneBody>;
  }

  return (
    <PaneBody>
      {isEventSubprocess && <span className="badge bg-info text-dark mb-2 d-inline-block">Event Sub-Process</span>}
      <ChildProcessInstanceLink
        model={props.model}
        processModelId={flowNode.flowNodeModel?.id}
        processInstanceId={childProcessInstanceId}
        studio={props.studio}
      />
    </PaneBody>
  );
}
