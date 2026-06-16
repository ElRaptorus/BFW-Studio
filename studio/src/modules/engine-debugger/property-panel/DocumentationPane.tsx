import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { MarkdownEditor, OpenInNewTabButton, Pane, PaneHeader } from '@evil/bifrost_fw_sdk';

import { ENGINE_DEBUGGER_DOCUMENT_TYPE } from '../Constants';
import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Documentation';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument?.documentType !== ENGINE_DEBUGGER_DOCUMENT_TYPE || editorDocumentModel == null) {
    return false;
  }

  const model = editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  return model.selectedElements?.length === 1;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const element = model.selectedElements[0];

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        {element != null && (
          <OpenInNewTabButton
            studio={props.studio}
            type="engine-debug.docs"
            parentUri={props.editorDocument.uri}
            fragmentId={element.id}
            dataTest="debugger-documentation-open-in-new-tab"
          />
        )}
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const element = model.selectedElements[0];

  if (element == null) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <MarkdownEditor
        key={`debugger_docs__${element.id}`}
        studio={props.studio}
        data={element.documentation ?? ''}
        readonly={true}
        htmlAttributes={{ style: { height: '100%' } }}
      />
    </div>
  );
}
