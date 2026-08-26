import { isUrlForOpenInNewTab } from '#bifrost/common/OpenInNewTabUrl';
import type { DocumentInspectorProps } from '#bifrost/contracts/PaneTypes';

import React from 'react';

import { MultiLineCodeEditor } from '../../MultiLineCodeEditor';
import { OpenInNewTabButton } from '../../OpenInNewTabButton';

export function DocumentTypeDefinitionInspector(props: DocumentInspectorProps): React.JSX.Element {
  const isBufferDocument = props.editorDocument.uri.startsWith('buffer:');

  if (isBufferDocument) {
    return (
      <p className="document_inspector--empty">
        You are viewing an unsaved Buffer Document. No type definition is available.
      </p>
    );
  }

  const definiion = props.studio.editors.getDocumentTypeDefinitionByUri(props.editorDocument.uri);

  const stringifiedDefinition = JSON.stringify(definiion, null, 2);

  const isOpenInNewTabDocument = isUrlForOpenInNewTab(props.editorDocument.uri);

  return (
    <div className="pane__content default_document_inspector">
      <div className="default_document_inspector__header">
        <span className="default_document_inspector__header--text">Document Type Definition</span>
        <div className="default_document_inspector__header--controls">
          <button
            className="btn btn-sm btn-secondary default_document_inspector__header--copy-button"
            onClick={() => navigator.clipboard.writeText(stringifiedDefinition)}
          >
            Copy
          </button>{' '}
          {!isOpenInNewTabDocument && (
            <OpenInNewTabButton
              studio={props.studio}
              type="Default.Document.Inspector.Item"
              parentUri={props.editorDocument.uri}
              fragmentId={`${props.editorDocument.uri}-document-type-definition`}
              additionalData={{ propertyName: 'Type Definition', value: stringifiedDefinition }}
              dataTest="open-document-inspector-type-definition-in-new-tab"
            />
          )}
        </div>
      </div>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="document-inspector-default-typedef"
        fontSize={12}
        initialValue={stringifiedDefinition}
        readOnly={true}
        language="json"
        onChange={() => {}}
      />
    </div>
  );
}
