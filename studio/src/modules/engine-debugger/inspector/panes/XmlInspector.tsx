import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';

export type XmlInspectorProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export function XmlInspector(props: XmlInspectorProps): React.JSX.Element {
  return (
    <div className="pane__content debugger-inspector-pane__content--flow-node-props">
      <div className="flow-node-props__information-header">
        <span className="flow-node-props__information-header--text">XML</span>
        <div className="flow-node-props__information-header--controls">
          <OpenInNewTabButton
            studio={props.studio}
            type="engine-debug.inspector-item"
            parentUri={props.editorDocument.uri}
            fragmentId={`${props.model.processInstance?.id}-process-model`}
            additionalData={{
              language: 'xml',
              processInstanceId: props.model.processInstance?.id,
              propertyName: 'XML',
              value: props.model.processInstance?.xml,
            }}
            dataTest="open-inspector-process-model-in-new-tab"
          />
        </div>
      </div>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-inspector-process-model"
        fontSize={12}
        initialValue={props.model.processInstance?.xml ?? ''}
        readOnly={true}
        language="xml"
        minimap={true}
      />
    </div>
  );
}
