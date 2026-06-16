import React from 'react';

import type { DocumentInspectorProps } from '@evil/bifrost_fw_sdk';
import { MultiLineCodeEditor } from '@evil/bifrost_fw_sdk';

import type { EditorDocumentMarkdownEditorModel } from './EditorDocumentMarkdownEditorModel';

export function EditorDocumentMarkdownEditorInspector(props: DocumentInspectorProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EditorDocumentMarkdownEditorModel;

  if (!model) {
    return null;
  }

  const stringifiedDocumentData = JSON.stringify(
    {
      ...props.editorDocument,
      modelData: JSON.stringify(model.getCurrentData()),
    },
    null,
    2,
  );

  return (
    <div className="pane__content default_document_inspector">
      <div className="default_document_inspector__header">
        <span className="default_document_inspector__header--text">Markdown Editor Data</span>
        <div className="default_document_inspector__header--controls">
          <button
            className="btn btn-sm btn-secondary default_document_inspector__header--copy-button"
            onClick={() => navigator.clipboard.writeText(stringifiedDocumentData)}
          >
            Copy
          </button>
        </div>
      </div>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="document-inspector-markdown-data"
        fontSize={12}
        initialValue={stringifiedDocumentData}
        readOnly={true}
        language="json"
      />
    </div>
  );
}
