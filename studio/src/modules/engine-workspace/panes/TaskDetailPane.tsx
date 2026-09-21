import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { getHumanizedDateTime } from '#modules/engine-core';

import React, { useCallback } from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type { TaskInboxDocumentModel } from '../models/TaskInboxDocumentModel';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Task Detail',
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function shouldBeDisplayed(editorDocument: EditorDocument | null | undefined): boolean {
  return editorDocument?.uri.startsWith('engine-task-inbox://') === true;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title="Task Detail" paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function formatFormFieldCount(formFields: unknown): string {
  if (Array.isArray(formFields)) {
    return String(formFields.length);
  }
  if (formFields) {
    return 'configured';
  }
  return '0';
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as TaskInboxDocumentModel | null;
  const task = model?.getSelectedTask() ?? null;
  const engineId = extractEngineId(props.editorDocument?.uri ?? '');

  const handleComplete = useCallback(() => {
    if (!task) {
      return;
    }
    props.studio.commands.executeCommand('engine.workspace.completeTask', [engineId, task.id]);
  }, [props.studio, engineId, task]);

  if (!task) {
    return null;
  }

  const typeProperties = task.typeProperties ?? {};
  const dueDate = typeof typeProperties.dueDate === 'string' ? typeProperties.dueDate : null;
  const formFieldCount = formatFormFieldCount(typeProperties.formFields);

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Flow node" value={task.flowNodeId} disabled />
      <PaneProperty type="text" label="Process instance" value={task.processInstanceId.slice(0, 8) + '…'} disabled />
      <PaneProperty type="text" label="Lane" value={task.laneName ?? '—'} disabled />
      <PaneProperty
        type="text"
        label="Waiting since"
        value={task.startedAt ? getHumanizedDateTime(task.startedAt) : '—'}
        disabled
      />
      <PaneProperty type="text" label="Due date" value={dueDate ? getHumanizedDateTime(dueDate) : '—'} disabled />
      <PaneProperty type="text" label="Form fields" value={formFieldCount} disabled />
      <div className="engine-pane-actions">
        <button type="button" className="engine-pane-actions__button" onClick={handleComplete}>
          Complete Task
        </button>
        <button
          type="button"
          className="engine-pane-actions__button"
          onClick={() =>
            props.studio.commands.executeCommand('engine.debugger.focusOrOpen', [engineId, task.processInstanceId])
          }
        >
          Open in Debugger
        </button>
      </div>
    </div>
  );
}

function extractEngineId(uri: string): string {
  const match = uri.match(/engine-task-inbox:\/\/([^?]+)/);
  return match?.[1] ?? '';
}
