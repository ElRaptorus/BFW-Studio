import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader } from '@evil/bifrost_fw_sdk';

import { DecisionTableViewer } from '../components/DecisionTableViewer';
import { describeExpressionBody, isDecisionTable } from '../helpers/dmnExpressionHelpers';
import type { DrgSelection } from '../types/dmnModelTypes';
import { getParsedModel, getSelection, isDecisionViewerDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Decision Table Detail';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isDecisionViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  if (selection?.type !== 'decision') {
    return false;
  }

  const decision = findSelectedDecision(editorDocumentModel, selection);
  return isDecisionTable(decision?.expression ?? null);
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
  if (!selection || selection.type !== 'decision') {
    return null;
  }

  const parsedModel = getParsedModel(props.editorDocumentModel);
  if (!parsedModel) {
    return null;
  }

  const decision = parsedModel.decisions.find((entry) => entry.id === selection.elementId);
  if (!decision) {
    return null;
  }

  if (!isDecisionTable(decision.expression)) {
    const expressionLabel = describeExpressionBody(decision.expression);
    return (
      <div className="engine-decision-table-viewer engine-decision-table-viewer--no-table">
        This decision uses a {expressionLabel.toLowerCase()} — not a decision table.
      </div>
    );
  }

  return <DecisionTableViewer decision={decision} />;
}

function findSelectedDecision(editorDocumentModel: EditorDocumentModel | null | undefined, selection: DrgSelection) {
  const parsedModel = getParsedModel(editorDocumentModel);
  if (!parsedModel) {
    return null;
  }
  return parsedModel.decisions.find((entry) => entry.id === selection.elementId) ?? null;
}
