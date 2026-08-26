import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import type { DmnDefinitions } from '#modules/engine-decision-viewer/types/dmnModelTypes';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import { getParsedModel, getSelection, isDecisionViewerDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Decision Service Detail';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isDecisionViewerDocument(editorDocument)) {
    return false;
  }
  return getSelection(editorDocumentModel)?.type === 'decisionService';
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

  const service = parsedModel.decisionServices.find((entry) => entry.id === selection.elementId);
  assertNotNull(service, 'service');

  return (
    <div className="engine-pane-decision-service">
      <PaneProperty type="text" label="Name" value={service.name ?? '(unnamed)'} disabled />
      <PaneProperty type="text" label="ID" value={service.id} disabled />

      <DecisionServiceList
        title="Output Decisions"
        ids={service.outputDecisions}
        parsedModel={parsedModel}
        resolveType="decision"
      />
      <DecisionServiceList
        title="Encapsulated Decisions"
        ids={service.encapsulatedDecisions}
        parsedModel={parsedModel}
        resolveType="decision"
      />
      <DecisionServiceList
        title="Input Decisions"
        ids={service.inputDecisions}
        parsedModel={parsedModel}
        resolveType="decision"
      />
      <DecisionServiceList
        title="Input Data"
        ids={service.inputData}
        parsedModel={parsedModel}
        resolveType="inputData"
      />
    </div>
  );
}

function DecisionServiceList(props: {
  title: string;
  ids: string[];
  parsedModel: DmnDefinitions;
  resolveType: 'decision' | 'inputData';
}): React.JSX.Element | null {
  if (props.ids.length === 0) {
    return null;
  }

  return (
    <div className="engine-pane-decision-service__list">
      <div className="engine-pane-decision-service__section-title">{props.title}</div>
      <ul>
        {props.ids.map((elementId) => {
          const label =
            props.resolveType === 'decision'
              ? (props.parsedModel.decisions.find((decision) => decision.id === elementId)?.name ?? elementId)
              : (props.parsedModel.inputData.find((inputData) => inputData.id === elementId)?.name ?? elementId);
          return <li key={elementId}>{label}</li>;
        })}
      </ul>
    </div>
  );
}
