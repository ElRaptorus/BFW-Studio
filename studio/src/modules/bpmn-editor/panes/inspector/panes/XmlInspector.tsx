import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';

import React from 'react';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';

export type XmlInspectorProps = {
  editorDocument: EditorDocument;
  model: BpmnDocumentModel;
  studio: Bifrost;
};

export function XmlInspector(props: XmlInspectorProps): React.JSX.Element {
  return (
    <div className="pane__content editor-inspector-pane__content--flow-node-props">
      <div className="flow-node-props__information-header">
        <span className="flow-node-props__information-header--text">XML</span>
        <div className="flow-node-props__information-header--controls">
          <OpenInNewTabButton
            studio={props.studio}
            type="bpmn.inspector.item"
            parentUri={props.editorDocument.uri}
            fragmentId={`${props.model.getCurrentFilename()}-process-model`}
            additionalData={{
              language: 'html',
              processId: props.model.getCurrentFilename(),
              propertyName: 'XML',
              value: props.model.currentXml,
            }}
            dataTest="open-inspector-process-model-in-new-tab"
          />
        </div>
      </div>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="editor-inspector-process-model"
        fontSize={12}
        initialValue={props.model.currentXml ?? ''}
        readOnly={true}
        language="html"
      />
    </div>
  );
}
