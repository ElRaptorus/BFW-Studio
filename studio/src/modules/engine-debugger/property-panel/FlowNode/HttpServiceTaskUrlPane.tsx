import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import type { FlowNodeInstance } from '@elraptorus/bfw_engine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/bfw_engine_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getHttpServiceTaskValue, getTypePropertyString } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayHttpServiceTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type HttpServiceTaskUrlPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayHttpServiceTaskInstancePane,
  Pane: PaneFull,
  PaneContent: HttpServiceTaskUrlPane,
};

function getPaneTitle(): string {
  return 'Http Service Task URL';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/http_service_task" />
      </PaneHeader>
      {props.collapsed !== true && <HttpServiceTaskUrlPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function HttpServiceTaskUrlPane(props: HttpServiceTaskUrlPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;

  const serviceTaskInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  const url = getHttpServiceTaskValue(flowNodeModel, 'httpUrl');
  const evaluatedUrl = getTypePropertyString(serviceTaskInstance.typeProperties, 'http_url');

  return (
    <PaneBody>
      <PaneProperty
        htmlId="http-task-url-evaluated"
        label="Url (Evaluated)"
        type="text"
        value={evaluatedUrl}
        disabled={true}
      />
      <PaneProperty
        htmlId="http-task-url-definition"
        label="Url (Definition)"
        type="text"
        value={url}
        disabled={true}
      />
    </PaneBody>
  );
}
