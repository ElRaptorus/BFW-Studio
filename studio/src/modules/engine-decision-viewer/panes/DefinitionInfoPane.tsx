import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { getHumanizedDateTime } from '#modules/engine-core/Formatters';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type { DecisionViewerModelData } from '../models/DecisionViewerDocumentModel';
import { getParsedModel, getSelection, isDecisionViewerDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Decision Definition';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isDecisionViewerDocument(editorDocument)) {
    return false;
  }
  return getSelection(editorDocumentModel) == null;
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
  const data = props.editorDocument?.data?.current as DecisionViewerModelData | null;
  if (!data?.definition) {
    return null;
  }
  const definition = data.definition;
  const parsedModel = getParsedModel(props.editorDocumentModel);

  return (
    <PaneBody>
      <PaneProperty type="text" label="Definition ID" value={definition.id} disabled />
      {definition.name && <PaneProperty type="text" label="Name" value={definition.name} disabled />}
      <PaneProperty type="text" label="Version" value={definition.version ?? '—'} disabled />
      <PaneProperty type="text" label="Enabled" value={definition.enabled ? 'Yes' : 'No'} disabled />
      {definition.deployedAt && (
        <PaneProperty type="text" label="Deployed at" value={getHumanizedDateTime(definition.deployedAt)} disabled />
      )}
      {parsedModel && (
        <>
          <PaneProperty type="text" label="Decisions" value={String(parsedModel.decisions.length)} disabled />
          <PaneProperty type="text" label="Input Data" value={String(parsedModel.inputData.length)} disabled />
          {parsedModel.businessKnowledgeModels.length > 0 && (
            <PaneProperty
              type="text"
              label="BKMs"
              value={String(parsedModel.businessKnowledgeModels.length)}
              disabled
            />
          )}
          {parsedModel.decisionServices.length > 0 && (
            <PaneProperty
              type="text"
              label="Decision Services"
              value={String(parsedModel.decisionServices.length)}
              disabled
            />
          )}
        </>
      )}
    </PaneBody>
  );
}
