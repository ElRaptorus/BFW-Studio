import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getHttpServiceTaskValue } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayHttpServiceTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type HttpServiceTaskMethodPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayHttpServiceTaskInstancePane,
  Pane: PaneFull,
  PaneContent: HttpServiceTaskMethodPane,
};

function getPaneTitle(): string {
  return 'Http Service Task Method';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/http_service_task" />
      </PaneHeader>
      {props.collapsed !== true && <HttpServiceTaskMethodPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function HttpServiceTaskMethodPane(props: HttpServiceTaskMethodPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;
  const method = getHttpServiceTaskValue(flowNodeModel, 'httpMethod') || 'GET';

  return (
    <PaneBody>
      <PaneProperty
        htmlId="http-task-method-property"
        label="Method"
        type="text"
        value={method.toUpperCase()}
        disabled={true}
      />
    </PaneBody>
  );
}
