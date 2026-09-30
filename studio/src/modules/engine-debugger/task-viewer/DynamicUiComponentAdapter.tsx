import type { Bifrost } from '#bifrost/Bifrost';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import type { FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';
import type { EngineConnectionManager } from '#modules/engine-core';

import React from 'react';

import type { FlowNodeInstance } from '@elraptorus/bfw_engine_sdk';

import { FormRenderer } from '../../bpmn-core/form-renderer';
import './DynamicUiComponentAdapter.scss';
import { confirmUserTaskCancel } from './confirmUserTaskCancel';
import { readFormActions, readFormFields, readSubmittedFormValues } from './readTaskForm';

function applyOutputTokenDefaults(fields: FormFieldDefinition[], outputToken: unknown): FormFieldDefinition[] {
  const values = readSubmittedFormValues(outputToken);
  return fields.map((field) => {
    const tokenValue = values[field.id];
    if (tokenValue != null) {
      return { ...field, defaultValue: String(tokenValue) };
    }
    return field;
  });
}

export function DynamicUiComponentAdapter(props: {
  engineId: string;
  studio: Bifrost;
  userTaskInstance: FlowNodeInstance;
  readOnly?: boolean;
  definitionFormSchema?: unknown;
  onClose: () => void;
}): React.JSX.Element {
  const runtimeFields = readFormFields(props.userTaskInstance.typeProperties?.form_schema);
  const definitionFields = readFormFields(props.definitionFormSchema);
  let fields = runtimeFields.length > 0 ? runtimeFields : definitionFields;
  const actions = readFormActions(props.userTaskInstance.typeProperties?.form_actions);

  if (props.readOnly) {
    fields = applyOutputTokenDefaults(fields, props.userTaskInstance.outputToken);
  }

  const resolveClient = () => {
    const connectionManager = props.studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
    return connectionManager.getClient(props.engineId);
  };

  const handleSubmit = async (actionId: string, values: Record<string, unknown>): Promise<void> => {
    if (props.readOnly) {
      return;
    }

    const client = resolveClient();
    if (!client) {
      return;
    }
    await client.userTasks.finish(props.userTaskInstance.id, { actionId, values });
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

    const confirmed = await confirmUserTaskCancel((options) => props.studio.dialog.open(options));
    if (!confirmed) {
      return;
    }

    const client = resolveClient();
    if (!client) {
      return;
    }
    await client.userTasks.cancel(props.userTaskInstance.id, { reason: actionId });
    props.onClose();
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
