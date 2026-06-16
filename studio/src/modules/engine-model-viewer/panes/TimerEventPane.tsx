import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getSelection, hasEventDefinition, isModelViewerDocument, matchesType } from './paneHelpers';

const TIMER_EVENT_POSITION_TYPES = [':StartEvent', ':IntermediateCatchEvent', ':BoundaryEvent'];

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Timer Event';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  if (!selection) {
    return false;
  }
  return matchesType(selection, TIMER_EVENT_POSITION_TYPES) && hasEventDefinition(selection, 'TimerEventDefinition');
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
  if (!selection) {
    return null;
  }
  const eventDefinitions = selection.businessObject.eventDefinitions as Record<string, unknown>[] | undefined;
  const timerDef = eventDefinitions?.find((def) => String(def.$type).includes('TimerEventDefinition'));
  if (!timerDef) {
    return null;
  }

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="timeDate" value={String((timerDef.timeDate as any)?.body ?? '—')} disabled />
      <PaneProperty
        type="text"
        label="timeDuration"
        value={String((timerDef.timeDuration as any)?.body ?? '—')}
        disabled
      />
      <PaneProperty type="text" label="timeCycle" value={String((timerDef.timeCycle as any)?.body ?? '—')} disabled />
    </div>
  );
}
