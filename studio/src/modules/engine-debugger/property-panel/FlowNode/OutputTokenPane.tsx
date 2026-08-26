import type { PaneComponentProps } from '#bifrost/contracts/PaneTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { PaneBody } from '#components/panes/PaneBody';
import { buildSimplePropertyPaneProvider } from '#components/panes/PaneFunctions';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayEndTokenPane } from '../ShouldBeDisplayedConditions';

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplayEndTokenPane,
  'Output Token',
  OutputTokenPane,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
    const flowNode = model.selectedElements[0] as FlowNode;
    const flowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
    const stringifiedOutputToken = JSON.stringify(flowNodeInstance.outputToken, null, 2);

    return (
      <OpenInNewTabButton
        studio={props.studio}
        type="engine-debug.json-property"
        parentUri={props.editorDocument.uri}
        fragmentId={`${flowNodeInstance.id}-output-token`}
        additionalData={{
          id: flowNodeInstance.id,
          flowNodeId: flowNode.name || flowNode.id,
          propertyName: 'Output Token',
          value: stringifiedOutputToken,
          scriptLanguage: 'json',
        }}
        dataTest="open-flow-node-instance-output-token-in-new-tab"
      />
    );
  },
);

function OutputTokenPane(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;
  const flowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
  const stringifiedOutputToken = JSON.stringify(flowNodeInstance.outputToken, null, 2);

  return (
    <PaneBody>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-flow-node-instance-output-token"
        fontSize={12}
        initialValue={stringifiedOutputToken}
        readOnly={true}
        size="tall"
        language="json"
      />
    </PaneBody>
  );
}
