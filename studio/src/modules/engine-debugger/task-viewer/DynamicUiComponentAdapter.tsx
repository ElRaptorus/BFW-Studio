import type { Bifrost } from '#bifrost/Bifrost';
import { Editor } from '#components/editor/Editor';
import { EditorContent } from '#components/editor/EditorContent';
import type { FormFieldDefinition } from '#modules/bpmn-core/form-renderer/FormModel';
import type { EngineConnectionManager } from '#modules/engine-core';

import React from 'react';

import type { FlowNodeInstance } from '@elraptorus/bfw_engine_sdk';

import { FormRenderer } from '../../bpmn-core/form-renderer';
import './DynamicUiComponentAdapter.scss';
import { readFormActions, readFormFields } from './readTaskForm';

function applyOutputTokenDefaults(
  fields: FormFieldDefinition[],
  outputToken: Record<string, unknown>,
): FormFieldDefinition[] {
  return fields.map((field) => {
    const tokenValue = outputToken[field.id];
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
  onTaskCompleted: () => void;
}): React.JSX.Element {
  const runtimeFields = readFormFields(props.userTaskInstance.typeProperties?.form_schema);
  const definitionFields = readFormFields(props.definitionFormSchema);
  let fields = runtimeFields.length > 0 ? runtimeFields : definitionFields;
  const actions = readFormActions(props.userTaskInstance.typeProperties?.form_actions);

  if (props.readOnly && props.userTaskInstance.outputToken != null) {
    fields = applyOutputTokenDefaults(fields, props.userTaskInstance.outputToken);
  }

  const handleSubmit = async (data: Record<string, unknown>): Promise<void> => {
    if (props.readOnly) {
      return;
    }

    const connectionManager = props.studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
    const client = connectionManager.getClient(props.engineId);
    if (!client) {
      return;
    }
    await client.userTasks.finish(props.userTaskInstance.id, { values: data });
    props.onTaskCompleted();
  };

  const handleCancel = async (actionId: string): Promise<void> => {
    if (props.readOnly) {
      return;
    }

    const connectionManager = props.studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
    const client = connectionManager.getClient(props.engineId);
    if (!client) {
      return;
    }
    await client.userTasks.cancel(props.userTaskInstance.id, { reason: actionId });
    props.onTaskCompleted();
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
              onCancel={handleCancel}
            />
          </div>
        </div>
      </EditorContent>
    </Editor>
  );
}
