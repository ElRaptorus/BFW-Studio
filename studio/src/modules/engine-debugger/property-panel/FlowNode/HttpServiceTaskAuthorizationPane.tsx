import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getServiceTaskConfigValue, getTypePropertyString } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayHttpServiceTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type HttpServiceTaskAuthorizationPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayHttpServiceTaskInstancePane,
  Pane: PaneFull,
  PaneContent: HttpServiceTaskAuthorizationPane,
};

function getPaneTitle(): string {
  return 'Http Service Task Authorization';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/http_service_task" />
      </PaneHeader>
      {props.collapsed !== true && <HttpServiceTaskAuthorizationPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function HttpServiceTaskAuthorizationPane(props: HttpServiceTaskAuthorizationPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;
  const serviceTaskInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  const authorization = getServiceTaskConfigValue(flowNodeModel, 'httpAuthHeader');
  const evaluatedAuthorization = getTypePropertyString(serviceTaskInstance.typeProperties, 'http_auth_header');

  return (
    <PaneBody>
      <PaneProperty
        htmlId="http-task-authorization-evaluated"
        label="Authorization (Evaluated)"
        type="text"
        value={evaluatedAuthorization}
        disabled={true}
      />
      <PaneProperty
        htmlId="http-task-authorization-definition"
        label="Authorization (Definition)"
        type="text"
        value={authorization}
        disabled={true}
      />
    </PaneBody>
  );
}
