import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { getHumanizedDateTime } from '#modules/engine-core';

import React, { useCallback } from 'react';

import { FlowNodeType } from '@elraptorus/bfw_engine_sdk';
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
  return '0';
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as TaskInboxDocumentModel | null;
  const task = model?.getSelectedTask() ?? null;
  const engineId = model?.getEngineId() ?? '';

  const handleComplete = useCallback(() => {
    if (!task) {
      return;
    }
    props.studio.commands.executeCommand('engine.workspace.taskInbox.completeSingle', [engineId, task]);
  }, [props.studio, engineId, task]);

  if (!task) {
    return null;
  }

  const typeProperties = task.typeProperties ?? {};
  const dueDate = typeof typeProperties.due_date === 'string' ? typeProperties.due_date : null;
  const formFieldCount = formatFormFieldCount(typeProperties.form_fields);

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
      {task.flowNodeType === FlowNodeType.ManualTask ? (
        <PaneProperty type="text" label="Kind" value="Manual Task" disabled={true} />
      ) : (
        <>
          <PaneProperty type="text" label="Due date" value={dueDate ? getHumanizedDateTime(dueDate) : '—'} disabled />
          <PaneProperty type="text" label="Form fields" value={formFieldCount} disabled />
        </>
      )}
      <div className="engine-pane-actions">
        <button
          type="button"
          className="engine-pane-actions__button"
          data-test--task-detail-complete=""
          onClick={handleComplete}
        >
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
