import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, Studio } from '@evil/bifrost_fw_sdk';
import {
  MultiLineCodeEditor,
  OpenInNewTabButton,
  PaneBody,
  PaneHeaderHelpIcon,
  buildSimplePropertyPaneProvider,
} from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getMessagePayloadExpression } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/index';
import { shouldDisplaySendTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type SendTaskPayloadPaneProps = {
  editorDocument: EditorDocument;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplaySendTaskInstancePane,
  'Payload',
  SendTaskPayload,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;

    const flowNode = props.editorDocumentModel.selectedElements[0] as FlowNode;
    const sendTaskModel = flowNode.flowNodeModel as BpmnFlowNode;
    const payloadExpression = getMessagePayloadExpression(sendTaskModel);

    const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);

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
          fragmentId={`${selectedFlowNodeInstance.id}-send-task-payload`}
          additionalData={{
            id: selectedFlowNodeInstance.id,
            flowNodeId: flowNode.name || flowNode.id,
            propertyName: 'SendTask Payload',
            value: payloadExpression,
            scriptLanguage: 'javascript',
          }}
          dataTest="open-send-task-instance-payload-in-new-tab"
        />
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/send_task" />
      </>
    );
  },
);

function SendTaskPayload(props: PaneComponentProps): React.JSX.Element {
  const flowNode = props.editorDocumentModel.selectedElements[0] as FlowNode;
  const sendTaskModel = flowNode.flowNodeModel as BpmnFlowNode;
  const payloadExpression = getMessagePayloadExpression(sendTaskModel);

  return (
    <PaneBody>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-send-task-instance-payload-property"
        size="tall"
        fontSize={12}
        initialValue={payloadExpression}
        readOnly={true}
        language="javascript"
      />
    </PaneBody>
  );
}
