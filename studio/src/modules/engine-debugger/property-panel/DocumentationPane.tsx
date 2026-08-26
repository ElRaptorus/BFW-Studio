import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { MarkdownEditor } from '#components/MarkdownEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

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

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const element = model.selectedElements[0];
  assertNotNull(element, 'element');

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
