import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { getHumanizedDateTime } from '#modules/engine-core';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type { DecisionCatalogDocumentModel } from '../models/DecisionCatalogDocumentModel';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Decision Summary',
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function shouldBeDisplayed(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.startsWith('engine://decisions/') === true;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title="Decision Summary" paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DecisionCatalogDocumentModel | null;
  const decision = model?.getSelectedDecision() ?? null;

  if (!decision) {
    return null;
  }

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Name" value={decision.name ?? '(unnamed)'} disabled />
      <PaneProperty type="text" label="Model ID" value={decision.id} disabled />
      <PaneProperty type="text" label="Version" value={decision.version ?? '—'} disabled />
      <PaneProperty type="text" label="Status" value={decision.enabled ? 'Enabled' : 'Disabled'} disabled />
      <PaneProperty
        type="text"
        label="Deployed"
        value={decision.deployedAt ? getHumanizedDateTime(decision.deployedAt) : '—'}
        disabled
      />
    </div>
  );
}
