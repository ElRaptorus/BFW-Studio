import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import { getUrlForOpenInNewTab } from '#bifrost/common/OpenInNewTabUrl';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';
import type { FormAction, FormFieldDefinition } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsUserTask } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';
import './PropertiesUserTaskFormSummary.scss';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Form Fields';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.UserTask);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  const element = bpmnDocumentModel?.selection?.getOnlyElementOrNull();

  let fieldCount = 0;
  if (element != null) {
    try {
      assertBpmnElementIsUserTask(element);
      fieldCount = element.formFieldDefinitions?.length ?? 0;
    } catch {
      // noop
    }
  }

  const headerSuffix = fieldCount > 0 ? ` (${fieldCount})` : '';

  return (
    <Pane>
      <PaneHeader
        studio={props.studio}
        title={`${getPaneTitle()}${headerSuffix}`}
        paneId={props.paneId}
        collapsed={props.collapsed}
      />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <FormSummaryContent key={getKeyForPropertiesPane(selection)} {...props} />;
}

function FormSummaryContent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsUserTask(element);

  const fields: FormFieldDefinition[] = element.formFieldDefinitions ?? [];
  const actions: FormAction[] = element.formActions ?? [];

  const handleEditForm = (event: React.MouseEvent): void => {
    const parentUri = bpmnDocumentModel.getUri();
    const uri = getUrlForOpenInNewTab('bpmn.form-builder', parentUri, element.id);

    if (event.shiftKey) {
      props.studio.commands.executeCommand('std.editor.openDocumentToTheSide', [uri]);
    } else {
      props.studio.commands.executeCommand('bpmn.formBuilder.open', [bpmnDocumentModel, element.id]);
    }
  };

  if (fields.length === 0 && actions.length === 0) {
    return (
      <PaneBody>
        <div className="form-summary-empty">
          <p className="form-summary-empty__message">No form fields configured</p>
          <button
            className="form-summary-empty__cta"
            type="button"
            data-test--form-summary-create-button
            onClick={handleEditForm}
            title="Open Form Builder (Shift+Click to open to the side)"
          >
            <Icon id="general/Add" /> Create Form
          </button>
        </div>
      </PaneBody>
    );
  }

  return (
    <PaneBody>
      <div className="form-summary">
        <ul className="form-summary__field-list">
          {fields.map((field) => (
            <li key={field.id} className="form-summary__field-item">
              <span className="form-summary__field-type">{field.type}</span>
              <span className="form-summary__field-label">{field.label || field.id}</span>
              {field.required === true && <span className="form-summary__required-badge">required</span>}
            </li>
          ))}
        </ul>

        {actions.length > 0 && (
          <div className="form-summary__actions-row">
            <span className="form-summary__actions-label">Actions:</span>
            <span className="form-summary__actions-value">{actions.map((action) => action.label).join(', ')}</span>
          </div>
        )}

        <button
          className="form-summary__edit-button"
          type="button"
          data-test--form-summary-edit-button
          onClick={handleEditForm}
          title="Open Form Builder (Shift+Click to open to the side)"
        >
          <Icon id="general/Edit" /> Edit Form
        </button>
      </div>
    </PaneBody>
  );
}
