import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps } from '#bifrost/contracts/PaneTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { PaneBody } from '#components/panes/PaneBody';
import { buildSimplePropertyPaneProvider } from '#components/panes/PaneFunctions';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayCallActivityInstancePane } from '../ShouldBeDisplayedConditions';

export type CallActivityPayloadPaneProps = {
  editorDocument: EditorDocument;
  studio: Bifrost;
  flowNode: FlowNode;
};

function serializeToken(token: Record<string, unknown> | null): string {
  if (token == null) {
    return '';
  }
  return JSON.stringify(token, null, 2);
}

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplayCallActivityInstancePane,
  'Payload',
  CallActivityPayload,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;

    const flowNode = props.editorDocumentModel.selectedElements[0] as FlowNode;

    const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
    const inputTokenText = serializeToken(selectedFlowNodeInstance.inputToken);

    return (
      <>
        <button
          className="btn btn-sm btn-secondary flow-node-props__information-header--copy-button"
          onClick={() => navigator.clipboard.writeText(inputTokenText)}
        >
          Copy
        </button>{' '}
        <OpenInNewTabButton
          studio={props.studio}
          type="engine-debug.json-property"
          parentUri={props.editorDocument.uri}
          fragmentId={`${selectedFlowNodeInstance.id}-call-activity-payload`}
          additionalData={{
            id: selectedFlowNodeInstance.id,
            flowNodeId: flowNode.name || flowNode.id,
            propertyName: 'Call Activity Payload',
            value: inputTokenText,
            scriptLanguage: 'json',
          }}
          dataTest="open-flow-node-instance-start-token-in-new-tab"
        />
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/call_activity" />
      </>
    );
  },
);

function CallActivityPayload(props: PaneComponentProps): React.JSX.Element {
  const flowNode = props.editorDocumentModel.selectedElements[0] as FlowNode;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
  const inputTokenText = serializeToken(selectedFlowNodeInstance.inputToken);

  return (
    <PaneBody key={selectedFlowNodeInstance.id}>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-flow-node-instance-start-token-property"
        size="tall"
        fontSize={12}
        initialValue={inputTokenText}
        readOnly={true}
        language="json"
      />
    </PaneBody>
  );
}
