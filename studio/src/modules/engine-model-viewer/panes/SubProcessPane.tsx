import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty, assertNotNull } from '@evil/bifrost_fw_sdk';

import { getSelectedBpmnFlowNode, getSelection, isModelViewerDocument, matchesType } from './paneHelpers';

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
  if (selection && matchesType(selection, [':AdHocSubProcess'])) {
    return 'Ad-hoc Sub-Process';
  }
  return 'Sub Process';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  return matchesType(selection, [':SubProcess', ':Transaction', ':AdHocSubProcess']);
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
  assertNotNull(selection, 'selection');

  const isTransaction = matchesType(selection, [':Transaction']);
  const isAdHoc = matchesType(selection, [':AdHocSubProcess']);
  const modeled = getSelectedBpmnFlowNode(props.editorDocumentModel);
  const typeData = modeled?.typeData.type === 'sub_process' ? modeled.typeData : undefined;
  const triggeredByEvent = typeData?.triggeredByEvent === true;
  const transactionMethod = isTransaction ? (typeData?.transactionMethod ?? null) : null;

  const adHocOrdering = isAdHoc ? (typeData?.adhocOrdering ?? 'parallel') : null;
  const adHocCancelRemaining = isAdHoc ? typeData?.cancelRemainingInstances !== false : null;
  const adHocCompletionCondition = isAdHoc ? (typeData?.adhocCompletionCondition ?? null) : null;
  const adHocImplementation = isAdHoc ? (typeData?.implementation ?? null) : null;
  const activeElements = isAdHoc ? (typeData?.activeElementsExpression ?? null) : null;

  return (
    <div className="engine-pane-process-info">
      {isTransaction && (
        <>
          <PaneProperty type="text" label="Type" value="Transaction Subprocess" disabled />
          <PaneProperty
            type="text"
            label="Method"
            value={transactionMethod ?? '(default — saga-pattern compensation)'}
            disabled
          />
        </>
      )}
      {isAdHoc && (
        <>
          <PaneProperty type="text" label="Type" value="Ad-hoc Sub-Process" disabled />
          <PaneProperty type="text" label="Ordering" value={adHocOrdering ?? 'parallel'} disabled />
          <PaneProperty
            type="text"
            label="Completion Condition"
            value={adHocCompletionCondition ?? '(all activities performed)'}
            disabled
          />
          <PaneProperty
            type="text"
            label="Cancel Remaining Instances"
            value={adHocCancelRemaining ? 'Yes' : 'No'}
            disabled
          />
          <PaneProperty type="text" label="Implementation" value={adHocImplementation ?? '(engine-managed)'} disabled />
          <PaneProperty
            type="text"
            label="Active Elements"
            value={activeElements ?? '(all enabled activities)'}
            disabled
          />
        </>
      )}
      {!isTransaction && !isAdHoc && (
        <PaneProperty type="text" label="Triggered by Event" value={triggeredByEvent ? 'Yes' : 'No'} disabled />
      )}
    </div>
  );
}
