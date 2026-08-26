import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { ProcessInstanceStateBadge, getHumanizedDateTime, getHumanizedDuration } from '#modules/engine-core';
import dayjs from 'dayjs';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type { InstanceSearchDocumentModel } from '../models/InstanceSearchDocumentModel';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Process Instance Summary',
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function shouldBeDisplayed(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.startsWith('engine://instances/') === true;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader
        studio={props.studio}
        title="Process Instance Summary"
        paneId={props.paneId}
        collapsed={props.collapsed}
      />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as InstanceSearchDocumentModel | null;
  const instance = model?.getSelectedInstance() ?? null;

  if (!instance) {
    return null;
  }

  const durationMs =
    instance.startedAt != null ? dayjs(instance.finishedAt ?? new Date()).diff(dayjs(instance.startedAt)) : null;
  const duration = durationMs != null ? getHumanizedDuration(durationMs) : '—';

  const startedBy =
    instance.startedBy && typeof instance.startedBy === 'object' && 'sub' in instance.startedBy
      ? String(instance.startedBy.sub)
      : '—';

  return (
    <PaneBody>
      <div className="form-group">
        <label className="d-block">State</label>
        <ProcessInstanceStateBadge state={instance.state} />
      </div>
      <PaneProperty type="text" label="Instance ID" value={instance.id} disabled />
      <PaneProperty type="text" label="Process" value={instance.processModelId ?? '—'} disabled />
      <PaneProperty type="text" label="Version" value={instance.version ?? '—'} disabled />
      <PaneProperty
        type="text"
        label="Started"
        value={instance.startedAt ? getHumanizedDateTime(instance.startedAt) : '—'}
        disabled
      />
      <PaneProperty type="text" label="Started by" value={startedBy} disabled />
      <PaneProperty type="text" label="Duration" value={duration} disabled />
      {instance.businessKey && <PaneProperty type="text" label="Business Key" value={instance.businessKey} disabled />}
      {instance.parentProcessInstanceId && (
        <PaneProperty type="text" label="Parent PI" value={instance.parentProcessInstanceId} disabled />
      )}
      {instance.errorInfo != null && (
        <>
          <PaneProperty type="text" label="Error Code" value={instance.errorInfo.error_code ?? '—'} disabled />
          <PaneProperty
            type="text"
            label="Error Message"
            value={typeof instance.errorInfo.message === 'string' ? instance.errorInfo.message : '—'}
            disabled
          />
        </>
      )}
    </PaneBody>
  );
}
