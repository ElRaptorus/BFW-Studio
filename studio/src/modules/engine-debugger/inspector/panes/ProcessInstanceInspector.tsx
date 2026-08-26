import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';

export type ProcessInstanceInspectorProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export function ProcessInstanceInspector(props: ProcessInstanceInspectorProps): React.JSX.Element {
  const processInstance = props.model.processInstance;
  const flowNodeInstances = props.model.flowNodeInstances;
  const dataObjectValues = props.model.dataObjectValues;

  const inspectedProcessInstance = {
    ...processInstance,
    flowNodeInstances: flowNodeInstances,
    dataObjectValues: dataObjectValues,
  };

  delete inspectedProcessInstance.xml;

  const stringifiedProcessInstance = JSON.stringify(inspectedProcessInstance, null, 2);

  return (
    <div className="pane__content debugger-inspector-pane__content--flow-node-props">
      <div className="flow-node-props__information-header">
        <span className="flow-node-props__information-header--text">Process Instance</span>
        <div className="flow-node-props__information-header--controls">
          <OpenInNewTabButton
            studio={props.studio}
            type="engine-debug.inspector-item"
            parentUri={props.editorDocument.uri}
            fragmentId={`${processInstance?.id}-process-instance`}
            additionalData={{
              processInstanceId: processInstance?.id,
              propertyName: 'Process Instance',
              value: stringifiedProcessInstance,
            }}
            dataTest="open-inspector-process-instance-in-new-tab"
          />
        </div>
      </div>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-inspector-process-instance"
        fontSize={12}
        initialValue={stringifiedProcessInstance}
        readOnly={true}
        language="json"
        minimap={true}
      />
    </div>
  );
}
