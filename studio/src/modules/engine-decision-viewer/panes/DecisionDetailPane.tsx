import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { describeExpressionBody } from '../helpers/dmnExpressionHelpers';
import type { DmnExpressionBody } from '../types/dmnModelTypes';
import { getParsedModel, getSelection, isDecisionViewerDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Decision Detail';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isDecisionViewerDocument(editorDocument)) {
    return false;
  }
  return getSelection(editorDocumentModel)?.type === 'decision';
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

  return (
    <div className="engine-pane-decision-detail">
      <PaneProperty type="text" label="Name" value={decision.name ?? '(unnamed)'} disabled />
      <PaneProperty type="text" label="ID" value={decision.id} disabled />
      <PaneProperty type="text" label="Expression Type" value={getExpressionTypeLabel(decision.expression)} disabled />

      {decision.informationRequirements.length > 0 && (
        <div className="engine-pane-decision-detail__requirements">
          <div className="engine-pane-decision-detail__section-title">Information Requirements</div>
          <ul>
            {decision.informationRequirements.map((requirement) => {
              const requiredDecision = requirement.requiredDecisionId
                ? parsedModel.decisions.find((entry) => entry.id === requirement.requiredDecisionId)
                : null;
              const requiredInput = requirement.requiredInputId
                ? parsedModel.inputData.find((entry) => entry.id === requirement.requiredInputId)
                : null;

              let label = 'Unknown requirement';
              if (requiredDecision) {
                label = `Decision: ${requiredDecision.name ?? requiredDecision.id}`;
              } else if (requiredInput) {
                label = `Input: ${requiredInput.name ?? requiredInput.id}`;
              } else if (requirement.requiredDecisionId) {
                label = `Decision: ${requirement.requiredDecisionId}`;
              } else if (requirement.requiredInputId) {
                label = `Input: ${requirement.requiredInputId}`;
              }

              return (
                <li key={requirement.id ?? `${requirement.requiredDecisionId}-${requirement.requiredInputId}`}>
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {decision.variable && (
        <>
          <PaneProperty type="text" label="Output Name" value={decision.variable.name} disabled />
          <PaneProperty type="text" label="Output Type" value={decision.variable.typeRef ?? '—'} disabled />
        </>
      )}
    </div>
  );
}

function getExpressionTypeLabel(expression: DmnExpressionBody | null | undefined): string {
  if (!expression) {
    return 'None';
  }
  if ('hitPolicy' in expression) {
    return 'Decision Table';
  }
  if ('text' in expression && !('contextEntries' in expression)) {
    return 'Literal Expression';
  }
  if ('contextEntries' in expression) {
    return 'Context';
  }
  if ('calledFunction' in expression || 'binding' in expression) {
    return 'Invocation';
  }
  if ('items' in expression) {
    return 'List';
  }
  if ('clauses' in expression) {
    return 'Relation';
  }
  return describeExpressionBody(expression);
}
