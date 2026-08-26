import { Bifrost } from '#bifrost/Bifrost';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';

import React from 'react';

import { DefaultDocumentInspector } from './DefaultDocumentInspector/DefaultDocumentInspector';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <div className="pane-header">{props.connectDragSource(<span>Editor Document Inspector</span>)}</div>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

export function getPaneTitle(): string {
  return 'Editor Document Inspector';
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);

  const focussedEditorDocument = props.studio.editors.getFocusedEditorDocument();

  if (!focussedEditorDocument) {
    return <p className="document_inspector--empty">Open and focus an Editor Document to inspect it.</p>;
  }

  let documentInspectorKey = focussedEditorDocument.inspectorKey;
  if (!documentInspectorKey && bifrost.editors.hasDocumentTypeDefinitionForUri(focussedEditorDocument.uri)) {
    // This is a fallback for long-lived documents that were already active before this feature was introduced.
    const documentDefinition = bifrost.editors.getDocumentTypeDefinitionByUri(focussedEditorDocument.uri);

    documentInspectorKey = documentDefinition.inspectorKey;
  }

  if (!documentInspectorKey) {
    return <DefaultDocumentInspector studio={props.studio} editorDocument={focussedEditorDocument} />;
  }

  const CustomInspector = bifrost.editors.getEditorDocumentInspector(documentInspectorKey);

  const editorDocumentModel = props.studio.editors.getEditorDocumentModelIfPresent(focussedEditorDocument);

  return (
    // eslint-disable-next-line
    <CustomInspector {...props} editorDocument={focussedEditorDocument} editorDocumentModel={editorDocumentModel} />
  );
}
