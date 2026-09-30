import type { Bifrost } from '#bifrost/Bifrost';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import { FormRenderer } from '#modules/bpmn-core/form-renderer';
import { ENGINE_COMMANDS } from '#modules/engine-core';

import React from 'react';

import type { FlowNodeInstance } from '@elraptorus/bfw_engine_sdk';

import './DynamicUiComponentAdapter.scss';
import { preferRuntimeEntries, readFormActions, readFormFields, readSubmittedFormValues } from './readTaskForm';

export function DynamicUiComponentAdapter(props: {
  engineId: string;
  studio: Bifrost;
  userTaskInstance: FlowNodeInstance;
  readOnly?: boolean;
  definitionFormFields?: unknown;
  definitionFormActions?: unknown;
  onClose: () => void;
}): React.JSX.Element {
  const fields = preferRuntimeEntries(
    readFormFields(props.userTaskInstance.typeProperties?.form_fields),
    readFormFields(props.definitionFormFields),
  );
  const actions = preferRuntimeEntries(
    readFormActions(props.userTaskInstance.typeProperties?.form_actions),
    readFormActions(props.definitionFormActions),
  );
  const initialValues = props.readOnly ? readSubmittedFormValues(props.userTaskInstance.outputToken) : undefined;

  const handleSubmit = async (actionId: string, values: Record<string, unknown>): Promise<void> => {
    if (props.readOnly) {
      return;
    }

    await props.studio.commands.executeCommand(ENGINE_COMMANDS.finishUserTask, [
      props.engineId,
      props.userTaskInstance.id,
      { actionId, values },
    ]);
    props.onClose();
  };

  const handleDismiss = (): void => {
    if (props.readOnly) {
      return;
    }
    props.onClose();
  };

  const handleAbort = async (actionId: string): Promise<void> => {
    if (props.readOnly) {
      return;
    }

    const cancelled = await props.studio.commands.executeCommand<Promise<boolean>>(
      'engine.debugger.taskView.cancelUserTask',
      [props.engineId, props.userTaskInstance.id, actionId],
    );
    if (cancelled) {
      props.onClose();
    }
  };

  const taskTitle = props.userTaskInstance.flowNodeId ?? 'User Task';

  return (
    <Editor>
      <EditorContent>
        <div className="dynamicui-container">
          <div className="dynamicui-container__card">
            <FormRenderer
              fields={fields}
              actions={actions}
              title={taskTitle}
              readOnly={props.readOnly}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              onDismiss={handleDismiss}
              onAbort={handleAbort}
            />
          </div>
        </div>
      </EditorContent>
    </Editor>
  );
}
