import React from 'react';

import type { EditorDocument, PaneComponentProps, Studio } from '@evil/bifrost_fw_sdk';
import {
  MultiLineCodeEditor,
  OpenInNewTabButton,
  PaneBody,
  buildSimplePropertyPaneProvider,
} from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayFlowNodeInstanceErrorPane } from '../ShouldBeDisplayedConditions';

export type FlowNodeInstanceErrorPaneProps = {
  editorDocument: EditorDocument;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplayFlowNodeInstanceErrorPane,
  'Error',
  FlowNodeInstanceErrorPane,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;

    const flowNode = model.selectedElements[0] as FlowNode;

    const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);

    return (
      <>
        <button
          className="btn btn-sm btn-secondary flow-node-props__information-header--copy-button"
          onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedFlowNodeInstance.errorInfo, null, 2))}
        >
          Copy
        </button>{' '}
        <OpenInNewTabButton
          studio={props.studio}
          type="engine-debug.json-property"
          parentUri={props.editorDocument.uri}
          fragmentId={`${selectedFlowNodeInstance.id}-error`}
          additionalData={{
            id: selectedFlowNodeInstance.id,
            flowNodeId: flowNode.name || flowNode.id,
            propertyName: 'Error',
            value: JSON.stringify(selectedFlowNodeInstance.errorInfo, null, 2),
            scriptLanguage: 'json',
          }}
          dataTest="open-flow-node-instance-error-in-new-tab"
        />
      </>
    );
  },
);

function FlowNodeInstanceErrorPane(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);

  return (
    <PaneBody>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-flow-node-instance-error-property"
        size="tall"
        fontSize={12}
        initialValue={JSON.stringify(selectedFlowNodeInstance.errorInfo, null, 2)}
        readOnly={true}
        language="json"
      />
    </PaneBody>
  );
}
