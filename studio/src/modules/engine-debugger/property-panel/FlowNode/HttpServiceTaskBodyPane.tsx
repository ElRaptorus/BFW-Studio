import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getHttpServiceTaskValue, getTypePropertyString } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { CopyableJsonDataRenderer } from '../CopyableJsonDataRenderer';
import { shouldDisplayHttpServiceTaskInstanceBodyPane } from '../ShouldBeDisplayedConditions';

export type HttpServiceTaskBodyPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayHttpServiceTaskInstanceBodyPane,
  Pane: PaneFull,
  PaneContent: HttpServiceTaskBodyPane,
};

function getPaneTitle(): string {
  return 'Http Service Task Body';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/http_service_task" />
      </PaneHeader>
      {props.collapsed !== true && <HttpServiceTaskBodyPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function HttpServiceTaskBodyPane(props: HttpServiceTaskBodyPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;

  const serviceTaskInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  const body = getHttpServiceTaskValue(flowNodeModel, 'httpBody');
  const evaluatedBody = getTypePropertyString(serviceTaskInstance.typeProperties, 'http_body');

  return (
    <PaneBody>
      <CopyableJsonDataRenderer
        editorDocument={props.editorDocument}
        id={serviceTaskInstance.id}
        flowNodeId={serviceTaskInstance.flowNodeId}
        flowNodeName={serviceTaskInstance.flowNodeId}
        language="javascript"
        propertyName="Body (Evaluated)"
        size="tall"
        studio={props.studio}
        value={evaluatedBody}
      />
      <CopyableJsonDataRenderer
        editorDocument={props.editorDocument}
        id={serviceTaskInstance.id}
        flowNodeId={serviceTaskInstance.flowNodeId}
        flowNodeName={serviceTaskInstance.flowNodeId}
        language="javascript"
        propertyName="Body (Definition)"
        size="tall"
        studio={props.studio}
        value={body}
      />
    </PaneBody>
  );
}
