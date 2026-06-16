import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';
import { FlowNodeInstanceState } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Icon, OpenInNewTabButton, Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getUserTaskFormSchema } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayUserTaskInstancePane } from '../ShouldBeDisplayedConditions';
import './UserTaskFormFieldsPane.scss';

type FormFieldSummary = {
  id: string;
  type: string;
  label?: string;
  required?: boolean;
};

type FormActionSummary = {
  id: string;
  label: string;
};

export type UserTaskFormFieldsPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayUserTaskInstancePane,
  Pane: PaneFull,
  PaneContent: UserTaskFormFieldsPane,
};

function getPaneTitle(): string {
  return 'User Task Form Fields';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/user_task_form_fields" />
      </PaneHeader>
      {props.collapsed !== true && <UserTaskFormFieldsPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function extractFieldSummaries(definitionSchema: unknown, runtimeSchema: unknown): FormFieldSummary[] {
  const schema = definitionSchema ?? runtimeSchema;
  if (schema == null || typeof schema !== 'object') {
    return [];
  }

  const items = Array.isArray(schema) ? schema : (schema as { fields?: unknown[] }).fields;

  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item: Record<string, unknown>) => ({
    id: String(item.id ?? ''),
    type: String(item.type ?? 'text'),
    label: item.label != null ? String(item.label) : undefined,
    required: item.required === true,
  }));
}

function extractActionSummaries(definitionSchema: unknown, userTaskInstance: FlowNodeInstance): FormActionSummary[] {
  const runtimeActions = userTaskInstance.typeProperties?.form_actions ?? userTaskInstance.typeProperties?.formActions;

  if (Array.isArray(runtimeActions) && runtimeActions.length > 0) {
    return (runtimeActions as Record<string, unknown>[]).map((action) => ({
      id: String(action.id ?? ''),
      label: String(action.label ?? ''),
    }));
  }

  if (definitionSchema != null && typeof definitionSchema === 'object' && !Array.isArray(definitionSchema)) {
    const defActions = (definitionSchema as { actions?: Record<string, unknown>[] }).actions;
    if (Array.isArray(defActions)) {
      return defActions.map((action) => ({
        id: String(action.id ?? ''),
        label: String(action.label ?? ''),
      }));
    }
  }

  return [];
}

function UserTaskFormFieldsPane(props: UserTaskFormFieldsPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const userTaskModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;
  const userTaskInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;
  const definitionSchema = getUserTaskFormSchema(userTaskModel);
  const runtimeSchema = userTaskInstance.typeProperties?.form_schema ?? userTaskInstance.typeProperties?.formSchema;

  const fields = extractFieldSummaries(definitionSchema, runtimeSchema);
  const actions = extractActionSummaries(definitionSchema, userTaskInstance);

  const isFinished = userTaskInstance.state === FlowNodeInstanceState.Finished;
  const hasOutputToken = userTaskInstance.outputToken != null;

  if (fields.length === 0 && actions.length === 0) {
    return (
      <PaneBody>
        <div className="debugger-form-summary-empty">
          <p className="debugger-form-summary-empty__message">No form fields configured</p>
        </div>
      </PaneBody>
    );
  }

  const handleReviewFilledForm = (): void => {
    props.studio.commands.executeCommand('engine.debugger.taskView.reviewCompleted', [props.model, userTaskInstance]);
  };

  const rawSchemaValue = runtimeSchema ?? definitionSchema;

  return (
    <PaneBody>
      <div className="debugger-form-summary">
        <ul className="debugger-form-summary__field-list" data-test--form-summary-field-list>
          {fields.map((field) => (
            <li key={field.id} className="debugger-form-summary__field-item">
              <span className="debugger-form-summary__field-type">{field.type}</span>
              <span className="debugger-form-summary__field-label">{field.label || field.id}</span>
              {field.required === true && <span className="debugger-form-summary__required-badge">required</span>}
            </li>
          ))}
        </ul>

        {actions.length > 0 && (
          <div className="debugger-form-summary__actions-row">
            <span className="debugger-form-summary__actions-label">Actions:</span>
            <span className="debugger-form-summary__actions-value">
              {actions.map((action) => action.label).join(', ')}
            </span>
          </div>
        )}

        <div className="debugger-form-summary__toolbar">
          {isFinished && hasOutputToken && (
            <button
              className="debugger-form-summary__review-button"
              type="button"
              data-test--form-summary-review-button
              onClick={handleReviewFilledForm}
              title="Review the completed form with the user's submitted data"
            >
              <Icon id="ph ph-eye" /> Review Filled Form
            </button>
          )}
          <OpenInNewTabButton
            studio={props.studio}
            type="engine-debug.json-property"
            parentUri={props.editorDocument.uri}
            fragmentId={`${userTaskInstance.id}-FormSchema`}
            additionalData={{
              id: userTaskInstance.id,
              flowNodeId: userTaskInstance.flowNodeId,
              flowNodeName: userTaskInstance.flowNodeId,
              propertyName: 'Form Schema',
              value: typeof rawSchemaValue !== 'string' ? JSON.stringify(rawSchemaValue, null, 2) : rawSchemaValue,
              scriptLanguage: 'json',
            }}
            dataTest="open-form-schema-in-new-tab"
          />
        </div>
      </div>
    </PaneBody>
  );
}
