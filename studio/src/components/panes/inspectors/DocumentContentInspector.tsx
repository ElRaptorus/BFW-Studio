import { isUrlForOpenInNewTab } from '#bifrost/common/OpenInNewTabUrl';
import type { DocumentInspectorProps } from '#bifrost/contracts/PaneTypes';

import React from 'react';

import { MultiLineCodeEditor } from '../../MultiLineCodeEditor';
import { OpenInNewTabButton } from '../../OpenInNewTabButton';

export function DocumentContentInspector(props: DocumentInspectorProps): React.JSX.Element {
  const stringifiedDocumentData = JSON.stringify(props.editorDocument, null, 2);

  const isOpenInNewTabDocument = isUrlForOpenInNewTab(props.editorDocument.uri);

  return (
    <div className="pane__content default_document_inspector">
      <div className="default_document_inspector__header">
        <span className="default_document_inspector__header--text">Document Data</span>
        <div className="default_document_inspector__header--controls">
          <button
            className="btn btn-sm btn-secondary default_document_inspector__header--copy-button"
            onClick={() => navigator.clipboard.writeText(stringifiedDocumentData)}
          >
            Copy
          </button>{' '}
          {!isOpenInNewTabDocument && (
            <OpenInNewTabButton
              studio={props.studio}
              type="Default.Document.Inspector.Item"
              parentUri={props.editorDocument.uri}
              fragmentId={`${props.editorDocument.uri}-document-content`}
              additionalData={{ propertyName: 'Data', value: stringifiedDocumentData }}
              dataTest="open-document-inspector-document-content-in-new-tab"
            />
          )}
        </div>
      </div>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="document-inspector-default-data"
        fontSize={12}
        initialValue={stringifiedDocumentData}
        readOnly={true}
        language="json"
        onChange={() => {}}
      />
    </div>
  );
}
