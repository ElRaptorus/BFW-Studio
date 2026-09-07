import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps } from '#bifrost/contracts/PaneTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { PaneBody } from '#components/panes/PaneBody';
import { buildSimplePropertyPaneProvider } from '#components/panes/PaneFunctions';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayComplexGatewayActivationConditionPane } from '../ShouldBeDisplayedConditions';

export type ComplexGatewayActivationConditionPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplayComplexGatewayActivationConditionPane,
  'Activation Condition',
  ComplexGatewayActivationConditionPane,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
    const flowNode = model.selectedElements[0] as FlowNode;
    const activationCondition = readActivationCondition(flowNode);

    return (
      <>
        <button
          className="btn btn-sm btn-secondary flow-node-props__information-header--copy-button"
          onClick={() => navigator.clipboard.writeText(activationCondition)}
        >
          Copy
        </button>{' '}
        <OpenInNewTabButton
          studio={props.studio}
          type="engine-debug.json-property"
          parentUri={props.editorDocument.uri}
          fragmentId={`${flowNode.id}-activation-condition`}
          additionalData={{
            flowNodeId: flowNode.id,
            flowNodeName: flowNode.name ?? flowNode.id,
            propertyName: 'Activation Condition',
            value: activationCondition,
            scriptLanguage: 'javascript',
          }}
          dataTest="open-complex-gateway-activation-condition-in-new-tab"
        />
      </>
    );
  },
);

function ComplexGatewayActivationConditionPane(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;
  const activationCondition = readActivationCondition(flowNode);

  return (
    <PaneBody key={flowNode.id}>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-complex-gateway-activation-condition-property"
        size="medium"
        fontSize={12}
        initialValue={activationCondition}
        readOnly={true}
        language="javascript"
      />
    </PaneBody>
  );
}

function readActivationCondition(flowNode: FlowNode): string {
  const typeData = flowNode.flowNodeModel?.typeData;
  if (typeData?.type !== 'complex_gateway') {
    return '';
  }
  return typeData.activationCondition ?? '';
}
