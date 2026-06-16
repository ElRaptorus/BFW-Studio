import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getUserTaskAssigneesExpression } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { CopyableJsonDataRenderer } from '../CopyableJsonDataRenderer';
import { shouldDisplayUserTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type UserTaskAssignedUsersPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayUserTaskInstancePane,
  Pane: PaneFull,
  PaneContent: UserTaskAssignedUsersPane,
};

function getPaneTitle(): string {
  return 'User Task Assigned Users';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/user_task_assignees_display" />
      </PaneHeader>
      {props.collapsed !== true && <UserTaskAssignedUsersPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function UserTaskAssignedUsersPane(props: UserTaskAssignedUsersPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const userTaskModel = flowNode.flowNodeModel as BpmnFlowNode;
  const userTaskInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  const assigneesExpression = getUserTaskAssigneesExpression(userTaskModel);
  const runtimeAssignees = userTaskInstance.typeProperties?.['assignees'];

  if (!assigneesExpression && runtimeAssignees == null) {
    return <PaneBody>No Users have been assigned.</PaneBody>;
  }

  return (
    <PaneBody>
      {runtimeAssignees != null && (
        <CopyableJsonDataRenderer
          editorDocument={props.editorDocument}
          id={userTaskInstance.id}
          flowNodeId={userTaskInstance.flowNodeId}
          flowNodeName={flowNode.name ?? userTaskInstance.flowNodeId}
          propertyName="Assigned Users (Evaluated)"
          size="small"
          language="json"
          studio={props.studio}
          value={runtimeAssignees}
        />
      )}
      {assigneesExpression && (
        <CopyableJsonDataRenderer
          editorDocument={props.editorDocument}
          id={userTaskInstance.id}
          flowNodeId={userTaskInstance.flowNodeId}
          flowNodeName={flowNode.name ?? userTaskInstance.flowNodeId}
          propertyName="Assigned Users (Definition)"
          size="small"
          language="javascript"
          studio={props.studio}
          value={assigneesExpression}
        />
      )}
    </PaneBody>
  );
}
