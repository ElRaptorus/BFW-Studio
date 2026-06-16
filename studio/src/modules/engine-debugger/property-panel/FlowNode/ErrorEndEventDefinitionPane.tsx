import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getErrorCode, getErrorMessage } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayErrorEndEventInstancePane } from '../ShouldBeDisplayedConditions';

type ErrorEndEventDefinitionPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayErrorEndEventInstancePane,
  Pane: PaneFull,
  PaneContent: ErrorEndEventDefinitionPane,
};

function getPaneTitle(): string {
  return 'Error End Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/error_end_event" />
      </PaneHeader>
      {props.collapsed !== true && (
        <ErrorEndEventDefinitionPane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function ErrorEndEventDefinitionPane(props: ErrorEndEventDefinitionPaneProps): React.JSX.Element {
  const errorEvent = props.flowNode.flowNodeModel as BpmnFlowNode | undefined;
  const errorFlowNodeInstance = props.flowNode.flowNodeInstances[0];

  return (
    <PaneBody>
      <PaneProperty type="text" label="Error Code" disabled={true} value={getErrorCode(errorEvent)} />
      <PaneProperty
        type="text"
        label="Error Message (Definition)"
        disabled={true}
        value={getErrorMessage(errorEvent)}
      />
      <PaneProperty
        type="text"
        label="Error Message (Evaluated)"
        disabled={true}
        value={String((errorFlowNodeInstance?.errorInfo as { message?: unknown } | undefined)?.message ?? '')}
      />
    </PaneBody>
  );
}
