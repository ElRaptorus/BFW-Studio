import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps } from '#bifrost/contracts/PaneTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { PaneBody } from '#components/panes/PaneBody';
import { buildSimplePropertyPaneProvider } from '#components/panes/PaneFunctions';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayScriptTaskInstancePane } from '../ShouldBeDisplayedConditions';

export type ScriptTaskPaneProps = {
  editorDocument: EditorDocument;
  studio: Bifrost;
  flowNode: FlowNode;
};

export const paneProvider = buildSimplePropertyPaneProvider(
  shouldDisplayScriptTaskInstancePane,
  'Script Task',
  ScriptTaskPane,
  (props: PaneComponentProps) => {
    const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;

    const flowNode = model.selectedElements[0] as FlowNode;
    const flowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
    const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode;

    return (
      <>
        <button
          className="btn btn-sm btn-secondary flow-node-props__information-header--copy-button"
          onClick={() =>
            navigator.clipboard.writeText(
              (flowNodeModel.typeData.type === 'script_task' ? flowNodeModel.typeData.script : '') ?? '',
            )
          }
        >
          Copy
        </button>{' '}
        <OpenInNewTabButton
          studio={props.studio}
          type="engine-debug.json-property"
          parentUri={props.editorDocument.uri}
          fragmentId={`${flowNodeInstance.id}-executed-script`}
          additionalData={{
            id: flowNodeInstance.id,
            flowNodeId: flowNode.name || flowNode.id,
            propertyName: 'Script Body',
            value: flowNodeModel.typeData.type === 'script_task' ? flowNodeModel.typeData.script : '',
            scriptLanguage: 'javascript',
          }}
          dataTest="open-flow-node-instance-executed-script-in-new-tab"
        />
        <PaneHeaderHelpIcon studio={props.studio} id={'bpmn/properties/script_task'} />
      </>
    );
  },
);

function ScriptTaskPane(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode;

  return (
    <PaneBody>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-flow-node-instance-executed-script-property"
        size="tall"
        fontSize={12}
        initialValue={(flowNodeModel.typeData.type === 'script_task' ? flowNodeModel.typeData.script : '') ?? ''}
        readOnly={true}
        language="javascript"
      />
    </PaneBody>
  );
}
