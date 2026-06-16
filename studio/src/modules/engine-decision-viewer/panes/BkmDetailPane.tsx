import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { describeExpressionBody, getExpressionPreview } from '../helpers/dmnExpressionHelpers';
import { getParsedModel, getSelection, isDecisionViewerDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'BKM Detail';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isDecisionViewerDocument(editorDocument)) {
    return false;
  }
  return getSelection(editorDocumentModel)?.type === 'businessKnowledgeModel';
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
  if (!selection || selection.type !== 'businessKnowledgeModel') {
    return null;
  }

  const parsedModel = getParsedModel(props.editorDocumentModel);
  if (!parsedModel) {
    return null;
  }

  const bkm = parsedModel.businessKnowledgeModels.find((entry) => entry.id === selection.elementId);
  if (!bkm) {
    return null;
  }

  const logic = bkm.encapsulatedLogic;

  return (
    <div className="engine-pane-bkm-detail">
      <PaneProperty type="text" label="Name" value={bkm.name ?? '(unnamed)'} disabled />
      <PaneProperty type="text" label="ID" value={bkm.id} disabled />
      {bkm.variable && (
        <>
          <PaneProperty type="text" label="Output Name" value={bkm.variable.name} disabled />
          <PaneProperty type="text" label="Output Type" value={bkm.variable.typeRef ?? '—'} disabled />
        </>
      )}

      {logic && (
        <>
          <PaneProperty type="text" label="Logic Type" value={describeExpressionBody(logic.body)} disabled />
          <PaneProperty type="text" label="Function Kind" value={logic.kind} disabled />
          {getExpressionPreview(logic.body) != null && (
            <PaneProperty type="text" label="Preview" value={getExpressionPreview(logic.body)!} disabled />
          )}

          {logic.formalParameters.length > 0 && (
            <div className="engine-pane-bkm-detail__parameters">
              <div className="engine-pane-bkm-detail__section-title">Formal Parameters</div>
              <table className="engine-pane-bkm-detail__table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {logic.formalParameters.map((parameter) => (
                    <tr key={parameter.id ?? parameter.name}>
                      <td>{parameter.name}</td>
                      <td>{parameter.typeRef ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {bkm.knowledgeRequirements.length > 0 && (
        <div className="engine-pane-bkm-detail__requirements">
          <div className="engine-pane-bkm-detail__section-title">Knowledge Requirements</div>
          <ul>
            {bkm.knowledgeRequirements.map((requirement) => {
              const dependentBkm = parsedModel.businessKnowledgeModels.find(
                (entry) => entry.id === requirement.requiredKnowledgeId,
              );
              return (
                <li key={requirement.id ?? requirement.requiredKnowledgeId}>
                  {dependentBkm?.name ?? requirement.requiredKnowledgeId}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
