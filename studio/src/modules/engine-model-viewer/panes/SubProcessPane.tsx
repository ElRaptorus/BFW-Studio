import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getSelection, isModelViewerDocument, matchesType } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(_editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): string {
  const selection = getSelection(editorDocumentModel);
  if (selection && matchesType(selection, [':Transaction'])) {
    return 'Transaction Subprocess';
  }
  return 'Sub Process';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  return matchesType(selection, [':SubProcess', ':Transaction']);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const title = getPaneTitle(props.editorDocument, props.editorDocumentModel);
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={title} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getSelection(props.editorDocumentModel);
  if (!selection) {
    return null;
  }

  const isTransaction = matchesType(selection, [':Transaction']);
  const triggeredByEvent = selection.businessObject.triggeredByEvent === true;
  const transactionMethod = isTransaction ? ((selection.businessObject.method as string | undefined) ?? null) : null;

  return (
    <div className="engine-pane-process-info">
      {isTransaction ? (
        <>
          <PaneProperty type="text" label="Type" value="Transaction Subprocess" disabled />
          <PaneProperty
            type="text"
            label="Method"
            value={transactionMethod ?? '(default — saga-pattern compensation)'}
            disabled
          />
        </>
      ) : (
        <PaneProperty type="text" label="Triggered by Event" value={triggeredByEvent ? 'Yes' : 'No'} disabled />
      )}
    </div>
  );
}
