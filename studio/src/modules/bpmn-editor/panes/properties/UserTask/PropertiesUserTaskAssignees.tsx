import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { LabelWithFeelExpressionHint } from '#components/FeelExpressionHint';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useEffect, useState } from 'react';

import type { FeelEditorVariable } from '@elraptorus/bfw_studio_sdk';
import { FeelEditor } from '@elraptorus/bfw_studio_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsUserTask } from '../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Assignees';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const selection = getBpmnSelectionForPropertiesPane(props);
  const selectedElement = selection?.[0];

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        {selectedElement != null && (
          <OpenInNewTabButton
            studio={props.studio}
            type="bpmn.user-task-assignees"
            parentUri={props.editorDocument.uri}
            fragmentId={selectedElement.id}
            dataTest="open-user-task-assignees-in-new-tab"
          />
        )}
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/user_task_assignees" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.UserTask);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesUserTaskAssignees key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesUserTaskAssignees(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsUserTask(element);

  const changeAssignees = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'userTaskExtensions', {
      assignees: value,
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
          <LabelWithFeelExpressionHint studio={props.studio} label="Assignees" />
        </label>
        <FeelEditor
          initialValue={element.assignees ?? ''}
          size="medium"
          fontSize={12}
          onChange={(value: string) => changeAssignees(value)}
          variables={feelVariables}
          htmlId="user-task-assignees-property"
          htmlAttributes={{ 'data-test--user-task-assignees-input': true }}
        />
      </div>
    </PaneBody>
  );
}
