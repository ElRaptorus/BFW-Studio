import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import type { DrgSelection } from '#modules/engine-decision-viewer/types/dmnModelTypes';

import React from 'react';

import { DecisionTableViewer } from '../components/DecisionTableViewer';
import { isDecisionTable } from '../helpers/dmnExpressionHelpers';
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

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const selection = getSelection(props.editorDocumentModel);
  assertNotNull(selection, 'selection');

  const parsedModel = getParsedModel(props.editorDocumentModel);
  assertNotNull(parsedModel, 'parsedModel');

  const decision = parsedModel.decisions.find((entry) => entry.id === selection.elementId);
  assertNotNull(decision, 'decision');

  return <DecisionTableViewer decision={decision} />;
}

function findSelectedDecision(editorDocumentModel: EditorDocumentModel | null | undefined, selection: DrgSelection) {
  const parsedModel = getParsedModel(editorDocumentModel);
  if (!parsedModel) {
    return null;
  }
  return parsedModel.decisions.find((entry) => entry.id === selection.elementId) ?? null;
}
