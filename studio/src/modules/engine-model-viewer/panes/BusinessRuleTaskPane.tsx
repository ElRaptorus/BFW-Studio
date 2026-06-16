import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getExtensionValue, getSelection, isModelViewerDocument, matchesType } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Business Rule Task';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return matchesType(getSelection(editorDocumentModel), [':BusinessRuleTask']);
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
  const implementation = String(businessObject.implementation ?? '—');
  const isDmn = implementation === 'dmn';
  const isFeel = implementation === 'feel';
  const script = businessObject.script as string | undefined;

  const decisionRef = getExtensionValue(businessObject, ':decisionRef');
  const decisionElementId = getExtensionValue(businessObject, ':decisionElementId');
  const resultVariable = getExtensionValue(businessObject, ':resultVariable');
  const traceUnmatchedRules = getExtensionValue(businessObject, ':traceUnmatchedRules');

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Implementation" value={implementation} disabled />
      {isFeel && <PaneProperty type="textarea" label="FEEL Script" value={script ?? '—'} disabled rows={6} />}
      {isDmn && <PaneProperty type="text" label="Decision Reference" value={decisionRef ?? '—'} disabled />}
      {isDmn && decisionElementId != null && (
        <PaneProperty type="text" label="Decision Element ID" value={decisionElementId} disabled />
      )}
      {isDmn && resultVariable != null && (
        <PaneProperty type="text" label="Result Variable" value={resultVariable} disabled />
      )}
      {isDmn && traceUnmatchedRules != null && (
        <PaneProperty type="text" label="Trace Unmatched Rules" value={traceUnmatchedRules} disabled />
      )}
    </div>
  );
}
