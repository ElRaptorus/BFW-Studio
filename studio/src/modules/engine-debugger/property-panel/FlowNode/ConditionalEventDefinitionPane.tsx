import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps } from '#bifrost/contracts/PaneTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { PaneBody } from '#components/panes/PaneBody';
import { buildSimplePropertyPaneProvider } from '#components/panes/PaneFunctions';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getConditionalExpression } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayConditionalEventInstancePane } from '../ShouldBeDisplayedConditions';

export type ConditionalEventDefinitionPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplayConditionalEventInstancePane,
  'Condition',
  ConditionalEventDefinitionPane,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
    const flowNode = model.selectedElements[0] as FlowNode;
    const conditionalEventModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;
    const conditionExpression = getConditionalExpression(conditionalEventModel);

    return (
      <>
        <button
          className="btn btn-sm btn-secondary flow-node-props__information-header--copy-button"
          onClick={() => navigator.clipboard.writeText(conditionExpression)}
        >
          Copy
        </button>{' '}
        <OpenInNewTabButton
          studio={props.studio}
          type="engine-debug.json-property"
          parentUri={props.editorDocument.uri}
          fragmentId={`${conditionalEventModel?.id ?? flowNode.id}-condition`}
          additionalData={{
            flowNodeId: flowNode.id,
            flowNodeName: flowNode.name ?? flowNode.id,
            propertyName: 'Condition',
            value: conditionExpression,
            scriptLanguage: 'javascript',
          }}
          dataTest="open-conditional-event-condition-definition-in-new-tab"
        />
      </>
    );
  },
);

function ConditionalEventDefinitionPane(props: PaneComponentProps): React.JSX.Element {
  const flowNode = props.editorDocumentModel.selectedElements[0] as FlowNode;
  const conditionalEventModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;
  const conditionExpression = getConditionalExpression(conditionalEventModel);

  return (
    <PaneBody>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-conditional-event-condition-definition-property"
        size="medium"
        fontSize={12}
        initialValue={conditionExpression}
        readOnly={true}
        language="javascript"
      />
    </PaneBody>
  );
}
