import type { PaneComponentProps } from '#bifrost/contracts/PaneTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { PaneBody } from '#components/panes/PaneBody';
import { buildSimplePropertyPaneProvider } from '#components/panes/PaneFunctions';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayStartTokenPane } from '../ShouldBeDisplayedConditions';

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplayStartTokenPane,
  'Input Token',
  InputTokenPane,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
    const flowNode = model.selectedElements[0] as FlowNode;
    const flowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
    const stringifiedInputToken = JSON.stringify(flowNodeInstance.inputToken, null, 2);

    return (
      <OpenInNewTabButton
        studio={props.studio}
        type="engine-debug.json-property"
        parentUri={props.editorDocument.uri}
        fragmentId={`${flowNodeInstance.id}-input-token`}
        additionalData={{
          id: flowNodeInstance.id,
          flowNodeId: flowNode.name || flowNode.id,
          propertyName: 'Input Token',
          value: stringifiedInputToken,
          scriptLanguage: 'json',
        }}
        dataTest="open-flow-node-instance-input-token-in-new-tab"
      />
    );
  },
);

function InputTokenPane(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;
  const flowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
  const stringifiedInputToken = JSON.stringify(flowNodeInstance.inputToken, null, 2);

  return (
    <PaneBody>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-flow-node-instance-input-token"
        fontSize={12}
        initialValue={stringifiedInputToken}
        readOnly={true}
        size="tall"
        language="json"
      />
    </PaneBody>
  );
}
