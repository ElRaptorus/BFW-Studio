import type { Bifrost } from '#bifrost/Bifrost';
import type { EngineConnectionManager } from '#modules/engine-core';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { Editor, EditorContent } from '@evil/bifrost_fw_sdk';
import type { FormAction, FormFieldDefinition } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';
import { FormActionPreset, FormFieldType } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

import { FormRenderer } from '../../bpmn-core/form-renderer';
import './DynamicUiComponentAdapter.scss';

type UserTaskFormField = {
  id: string;
  type: string;
  label?: string;
  defaultValue?: unknown;
  enumValues?: { id: string; name: string }[];
};

type UserTaskFormAction = {
  id: string;
  label: string;
  preset?: string;
  submitsForm?: boolean;
  isDefault?: boolean;
  isDanger?: boolean;
};

function extractFormFields(flowNodeInstance: FlowNodeInstance): UserTaskFormField[] {
  const formSchema = flowNodeInstance.typeProperties?.form_schema ?? flowNodeInstance.typeProperties?.formSchema;
  if (formSchema == null || typeof formSchema !== 'object') {
    return [];
  }
  if (Array.isArray(formSchema)) {
    return formSchema as UserTaskFormField[];
  }
  const fields = (formSchema as { fields?: UserTaskFormField[] }).fields;
  return Array.isArray(fields) ? fields : [];
}

function extractFormActions(flowNodeInstance: FlowNodeInstance): UserTaskFormAction[] | undefined {
  const formActions = flowNodeInstance.typeProperties?.form_actions ?? flowNodeInstance.typeProperties?.formActions;
  if (Array.isArray(formActions) && formActions.length > 0) {
    return formActions as UserTaskFormAction[];
  }
  const formSchema = flowNodeInstance.typeProperties?.form_schema ?? flowNodeInstance.typeProperties?.formSchema;
  if (formSchema == null || typeof formSchema !== 'object' || Array.isArray(formSchema)) {
    return undefined;
  }
  const actions = (formSchema as { actions?: UserTaskFormAction[] }).actions;
  return Array.isArray(actions) ? actions : undefined;
}

function mapEngineFieldToDefinition(engineField: UserTaskFormField): FormFieldDefinition {
  const typeMapping: Record<string, FormFieldType> = {
    text: FormFieldType.Text,
    string: FormFieldType.Text,
    number: FormFieldType.Number,
    integer: FormFieldType.Number,
    long: FormFieldType.Number,
    date: FormFieldType.Date,
    boolean: FormFieldType.Boolean,
    checkbox: FormFieldType.Checkbox,
    enum: FormFieldType.Select,
    select: FormFieldType.Select,
    radio: FormFieldType.Radio,
    textarea: FormFieldType.Textarea,
    file: FormFieldType.File,
    range: FormFieldType.Number,
    header: FormFieldType.Header,
    paragraph: FormFieldType.Header,
  };

  const mappedType = typeMapping[engineField.type] ?? FormFieldType.Text;

  const options =
    engineField.enumValues?.map((enumValue) => ({
      label: enumValue.name,
      value: enumValue.id,
    })) ?? [];

  return {
    id: engineField.id,
    type: mappedType,
    label: engineField.label ?? '',
    required: false,
    defaultValue: engineField.defaultValue != null ? String(engineField.defaultValue) : undefined,
    options: options.length > 0 ? options : undefined,
  };
}

function mapEngineActionsToFormActions(engineActions?: UserTaskFormAction[]): FormAction[] | undefined {
  if (engineActions == null || engineActions.length === 0) {
    return undefined;
  }

  const presetMapping: Record<string, FormActionPreset> = {
    confirm: FormActionPreset.Confirm,
    ok: FormActionPreset.Ok,
    yes: FormActionPreset.Yes,
    no: FormActionPreset.No,
    cancel: FormActionPreset.Cancel,
    custom: FormActionPreset.Custom,
  };

  return engineActions.map((engineAction) => ({
    id: engineAction.id,
    label: engineAction.label,
    preset: presetMapping[engineAction.preset ?? ''] ?? FormActionPreset.Custom,
    submitsForm: engineAction.submitsForm ?? true,
    isDefault: engineAction.isDefault ?? false,
    isDanger: engineAction.isDanger ?? false,
  }));
}

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

function extractFormFieldsFromSchema(schema: unknown): UserTaskFormField[] {
  if (schema == null || typeof schema !== 'object') {
    return [];
  }
  if (Array.isArray(schema)) {
    return schema as UserTaskFormField[];
  }
  const fields = (schema as { fields?: UserTaskFormField[] }).fields;
  return Array.isArray(fields) ? fields : [];
}

function extractFormActionsFromSchema(schema: unknown): UserTaskFormAction[] | undefined {
  if (schema == null || typeof schema !== 'object' || Array.isArray(schema)) {
    return undefined;
  }
  const actions = (schema as { actions?: UserTaskFormAction[] }).actions;
  return Array.isArray(actions) ? actions : undefined;
}

export function DynamicUiComponentAdapter(props: {
  engineId: string;
  studio: Bifrost;
  userTaskInstance: FlowNodeInstance;
  readOnly?: boolean;
  definitionFormSchema?: unknown;
  onTaskCompleted: () => void;
}): React.JSX.Element {
  const runtimeFields = extractFormFields(props.userTaskInstance);
  const definitionFields = extractFormFieldsFromSchema(props.definitionFormSchema);
  const resolvedFields = runtimeFields.length > 0 ? runtimeFields : definitionFields;

  let fields: FormFieldDefinition[] = resolvedFields.map(mapEngineFieldToDefinition);

  const runtimeActions = extractFormActions(props.userTaskInstance);
  const definitionActions = extractFormActionsFromSchema(props.definitionFormSchema);
  const resolvedActions = runtimeActions ?? definitionActions;
  const actions: FormAction[] = mapEngineActionsToFormActions(resolvedActions) ?? [];

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
    await client.userTasks.finish(props.userTaskInstance.id, { result: data });
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
