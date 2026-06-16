import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getEventDefinition, resolveSignalName } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/index';
import { shouldDisplaySignalEventPane } from '../ShouldBeDisplayedConditions';

type SignalEventNamePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplaySignalEventPane,
  Pane: PaneFull,
  PaneContent: SignalEventNamePane,
};

function getPaneTitle(): string {
  return 'Signal Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && (
        <SignalEventNamePane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function SignalEventNamePane(props: SignalEventNamePaneProps): React.JSX.Element {
  const signalEvent = props.flowNode.flowNodeModel as BpmnFlowNode;
  const eventDefinition = getEventDefinition(signalEvent);
  const signalName =
    props.model.processDefinition && eventDefinition?.type === 'signal'
      ? resolveSignalName(props.model.processDefinition, eventDefinition.signalRef)
      : null;

  return (
    <PaneBody>
      <PaneProperty type="text" label="Signal Name" disabled={true} value={signalName ?? ''} />
    </PaneBody>
  );
}
