import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getServiceTaskConfigValue } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayHttpServiceTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type HttpServiceTaskContentTypePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayHttpServiceTaskInstancePane,
  Pane: PaneFull,
  PaneContent: HttpServiceTaskContentTypePane,
};

function getPaneTitle(): string {
  return 'Http Service Task Content Type';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/http_service_task" />
      </PaneHeader>
      {props.collapsed !== true && <HttpServiceTaskContentTypePane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function HttpServiceTaskContentTypePane(props: HttpServiceTaskContentTypePaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode;

  const serviceTaskInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  const contentTypeDefinition = getServiceTaskConfigValue(flowNodeModel, 'httpContentType');
  const responseHeaders = serviceTaskInstance.typeProperties?.['response_headers'];
  const evaluatedContentType =
    responseHeaders != null &&
    typeof responseHeaders === 'object' &&
    'Content-Type' in (responseHeaders as Record<string, unknown>)
      ? String((responseHeaders as Record<string, unknown>)['Content-Type'])
      : '';

  return (
    <PaneBody>
      <PaneProperty
        htmlId="http-task-content-type-property"
        label="Content Type (Evaluated)"
        type="text"
        value={evaluatedContentType}
        disabled={true}
      />
      <PaneProperty
        htmlId="http-task-content-type-definition-property"
        label="Content Type (Definition)"
        type="text"
        value={contentTypeDefinition}
        disabled={true}
      />
    </PaneBody>
  );
}
