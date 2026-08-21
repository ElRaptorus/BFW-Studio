import React, { useEffect, useState } from 'react';

import type {
  BpmnDocumentModel,
  EditorDocument,
  FeelEditorVariable,
  PaneComponentProps,
  PaneProvider,
} from '@evil/bifrost_fw_sdk';
import {
  BpmnElementType,
  LabelWithFeelExpressionHint,
  OneLineFeelEditor,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';

import { assertBpmnElementIsUserTask } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

const USER_TASK_HELP_ID = 'bpmn/properties/user_task';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'User Task';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.UserTask);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={USER_TASK_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesUserTask key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesUserTask(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsUserTask(element);

  const changeDueDate = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'userTaskExtensions', {
      dueDate: value,
    });
  };

  const changePriority = (value: string): void => {
    const trimmed = value.trim();
    let priority: number | undefined;
    if (trimmed === '') {
      priority = undefined;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed)) {
        priority = parsed;
      } else {
        return;
      }
    }
    bpmnDocumentModel.elements.setElementProperty(element.id, 'userTaskExtensions', {
      priority,
    });
  };

  const [feelVariables, setFeelVariables] = useState<FeelEditorVariable[]>([]);
  const { editorDocument } = props;
  const { commands } = props.studio;
  useEffect(() => {
    commands
      .executeCommand<Promise<FeelEditorVariable[]>>('bpmn.feel.getExpressionContext', [editorDocument])
      .then(setFeelVariables);
  }, [editorDocument, commands]);

  return (
    <PaneBody>
      <div className="form-group">
        <label className="d-block">
          <LabelWithFeelExpressionHint studio={props.studio} label="Due Date" />
        </label>
        <OneLineFeelEditor
          studio={props.studio}
          initialValue={element.dueDate ?? ''}
          onChange={(value: string) => changeDueDate(value)}
          variables={feelVariables}
          htmlId="user-task-due-date-property"
          htmlAttributes={{ 'data-test--user-task-due-date-input': true }}
        />
      </div>
      <PaneProperty
        htmlId="user-task-priority-property"
        label="Priority"
        type="text"
        value={element.priority?.toString() ?? ''}
        searchQuery={editorDocument.metadata.searchQuery}
        onCommit={(value: string) => changePriority(value)}
        htmlAttributes={{ 'data-test--user-task-priority-input': true }}
      />
    </PaneBody>
  );
}
