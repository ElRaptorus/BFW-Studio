import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { getHumanizedDateTime } from '#modules/engine-core';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type { TimerSchedulesDocumentModel } from '../models/TimerSchedulesDocumentModel';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Schedule Detail',
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function shouldBeDisplayed(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.startsWith('engine://timers/') === true;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title="Schedule Detail" paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as TimerSchedulesDocumentModel | null;
  const schedule = model?.getSelectedSchedule() ?? null;

  if (!schedule) {
    return null;
  }

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Process model" value={schedule.processModelId} disabled />
      <PaneProperty type="text" label="Start event" value={schedule.flowNodeId} disabled />
      <PaneProperty type="text" label="Kind" value={schedule.kind} disabled />
      <PaneProperty type="text" label="Expression" value={schedule.isoSpec} disabled />
      <PaneProperty type="text" label="Status" value={schedule.enabled ? 'Enabled' : 'Disabled'} disabled />
      <PaneProperty
        type="text"
        label="Next fire"
        value={schedule.nextFireAt ? getHumanizedDateTime(schedule.nextFireAt) : '—'}
        disabled
      />
      {schedule.lastTriggeredAt && (
        <PaneProperty
          type="text"
          label="Last triggered"
          value={getHumanizedDateTime(schedule.lastTriggeredAt)}
          disabled
        />
      )}
    </div>
  );
}
