import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getHttpServiceTaskValue, getTypePropertyString } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayHttpServiceTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type HttpServiceTaskResponseHeadersPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayHttpServiceTaskInstancePane,
  Pane: PaneFull,
  PaneContent: HttpServiceTaskResponseHeadersPane,
};

function getPaneTitle(): string {
  return 'Http Service Task Response Headers';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/http_service_task" />
      </PaneHeader>
      {props.collapsed !== true && <HttpServiceTaskResponseHeadersPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function HttpServiceTaskResponseHeadersPane(props: HttpServiceTaskResponseHeadersPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;
  const serviceTaskInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  const responseHeaders = getHttpServiceTaskValue(flowNodeModel, 'httpResponseHeaders');
  const evaluatedResponseHeaders = getTypePropertyString(serviceTaskInstance.typeProperties, 'http_response_headers');

  return (
    <PaneBody>
      <PaneProperty
        htmlId="http-task-response-headers-evaluated"
        label="Response Headers (Evaluated)"
        type="text"
        value={evaluatedResponseHeaders}
        disabled={true}
      />
      <PaneProperty
        htmlId="http-task-response-headers-definition"
        label="Response Headers (Definition)"
        type="text"
        value={responseHeaders}
        disabled={true}
      />
    </PaneBody>
  );
}
