import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getExtensionValue, getSelection, isModelViewerDocument, matchesType, moddleRefId } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Data Object';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return matchesType(getSelection(editorDocumentModel), [':DataObjectReference', ':DataObject', ':DataStoreReference']);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getSelection(props.editorDocumentModel);
  if (!selection) {
    return null;
  }

  const businessObject = selection.businessObject;
  const dataObjectRef = moddleRefId(businessObject.dataObjectRef);
  const valueContract = getExtensionValue(businessObject, ':valueContract');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Data Object Ref" value={dataObjectRef} disabled />
      {valueContract != null && (
        <PaneProperty type="textarea" label="Value Contract" value={valueContract} disabled rows={5} />
      )}
    </div>
  );
}
