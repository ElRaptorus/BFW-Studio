import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getSelection, isModelViewerDocument, matchesType, readFlowNodeString } from './paneHelpers';

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
  const implementation =
    readFlowNodeString(props.editorDocumentModel, (flowNode) =>
      flowNode.typeData.type === 'business_rule_task' ? flowNode.typeData.implementation : undefined,
    ) ?? '—';
  const isDmn = implementation === 'dmn';
  const isFeel = implementation === 'feel';
  const script = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'business_rule_task' ? flowNode.typeData.script : undefined,
  );

  const decisionRef = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'business_rule_task' ? flowNode.typeData.decisionRef : undefined,
  );
  const decisionElementId = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'business_rule_task' ? flowNode.typeData.decisionElementId : undefined,
  );
  const resultVariable = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'business_rule_task' ? flowNode.typeData.resultVariable : undefined,
  );
  const traceUnmatchedRules = readFlowNodeString(props.editorDocumentModel, (flowNode) => {
    if (flowNode.typeData.type !== 'business_rule_task') {
      return undefined;
    }
    return flowNode.typeData.traceUnmatchedRules ? 'true' : 'false';
  });

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
