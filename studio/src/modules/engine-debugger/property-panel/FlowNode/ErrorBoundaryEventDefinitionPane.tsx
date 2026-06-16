import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getErrorCode, getErrorMessage } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayErrorBoundaryEventInstancePane } from '../ShouldBeDisplayedConditions';

type ErrorBoundaryEventDefinitionPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayErrorBoundaryEventInstancePane,
  Pane: PaneFull,
  PaneContent: ErrorBoundaryEventDefinitionPane,
};

function getPaneTitle(): string {
  return 'Error Boundary Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/error_boundary_event" />
      </PaneHeader>
      {props.collapsed !== true && (
        <ErrorBoundaryEventDefinitionPane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function ErrorBoundaryEventDefinitionPane(props: ErrorBoundaryEventDefinitionPaneProps): React.JSX.Element {
  const errorEvent = props.flowNode.flowNodeModel as BpmnFlowNode | undefined;
  const errorCode = getErrorCode(errorEvent);
  const errorMessage = getErrorMessage(errorEvent);

  if (!errorCode && !errorMessage) {
    return (
      <PaneBody>
        <p>Catches all Errors</p>
      </PaneBody>
    );
  }

  return (
    <PaneBody>
      <p>Catches specific Errors</p>
      <PaneProperty type="text" label="Error Code" disabled={true} value={errorCode} />
      <PaneProperty type="text" label="Error Message" disabled={true} value={errorMessage} />
    </PaneBody>
  );
}
