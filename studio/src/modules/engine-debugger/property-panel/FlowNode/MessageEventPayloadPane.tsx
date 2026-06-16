import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, Studio } from '@evil/bifrost_fw_sdk';
import {
  MultiLineCodeEditor,
  OpenInNewTabButton,
  PaneBody,
  buildSimplePropertyPaneProvider,
} from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getMessagePayloadExpression } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayMessagePayloadPane } from '../ShouldBeDisplayedConditions';

export type MessageEventPayloadPaneProps = {
  editorDocument: EditorDocument;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplayMessagePayloadPane,
  'Message Payload',
  MessageEventPayloadPane,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;

    const flowNode = model.selectedElements[0] as FlowNode;
    const flowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
    const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode;
    const payloadExpression = getMessagePayloadExpression(flowNodeModel);

    return (
      <>
        <button
          className="btn btn-sm btn-secondary flow-node-props__information-header--copy-button"
          onClick={() => navigator.clipboard.writeText(payloadExpression)}
        >
          Copy
        </button>{' '}
        <OpenInNewTabButton
          studio={props.studio}
          type="engine-debug.json-property"
          parentUri={props.editorDocument.uri}
          fragmentId={`${flowNodeInstance.id}-message-event-payload`}
          additionalData={{
            id: flowNodeInstance.id,
            flowNodeId: flowNode.name || flowNode.id,
            propertyName: 'Message Event Payload',
            value: payloadExpression,
            scriptLanguage: 'javascript',
          }}
          dataTest="open-flow-node-instance-message-event-payload-in-new-tab"
        />
      </>
    );
  },
);

function MessageEventPayloadPane(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode;
  const payloadExpression = getMessagePayloadExpression(flowNodeModel);

  return (
    <PaneBody>
      <div className="form-group">
        <label>Payload Definition</label>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="debugger-flow-node-instance-message-event-payload-property"
          size="tall"
          fontSize={12}
          initialValue={payloadExpression}
          readOnly={true}
          language="javascript"
        />
      </div>
      <p>Note: The actual Payload is stored in the Output Token.</p>
    </PaneBody>
  );
}
