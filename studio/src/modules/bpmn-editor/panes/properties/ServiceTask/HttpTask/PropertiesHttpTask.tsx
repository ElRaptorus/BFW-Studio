import type { Bifrost } from '#bifrost/Bifrost';

import React, { useEffect, useState } from 'react';

import type {
  EditorDocument,
  FeelEditorVariable,
  PaneComponentProps,
  PaneProvider,
  SelectOption,
} from '@evil/bifrost_fw_sdk';
import {
  BpmnElementType,
  FeelEditor,
  FeelExpressionHint,
  OneLineFeelEditor,
  OpenInNewTabButton,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../../BpmnDocumentModel';
import { assertBpmnElementIsHttpServiceTask } from '../../../BpmnElementTypeAssertionFunctions';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../../PropertiesPaneFunctions';

type HttpTaskToUpdate =
  | HttpTaskToUpdate_Method
  | HttpTaskToUpdate_Url
  | HttpTaskToUpdate_Body
  | HttpTaskToUpdate_AuthHeader
  | HttpTaskToUpdate_ResponseHeaders;

type HttpTaskToUpdate_Method = {
  method: string;
};

type HttpTaskToUpdate_Url = {
  url: string;
};

type HttpTaskToUpdate_Body = {
  body: string;
};

type HttpTaskToUpdate_AuthHeader = {
  authHeader: string;
};

type HttpTaskToUpdate_ResponseHeaders = {
  responseHeaders: string;
};

const selectOptions: SelectOption[] = [
  { value: 'get', label: 'GET' },
  { value: 'post', label: 'POST' },
  { value: 'put', label: 'PUT' },
  { value: 'delete', label: 'DELETE' },
];

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'HTTP Service Task';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element | null {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/service_task" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any, bifrost: Bifrost): boolean {
  const isMatchingTaskType = shouldBeDisplayedForBpmnElementOfType(
    editorDocument,
    editorDocumentModel,
    BpmnElementType.HttpServiceTask,
  );

  const customPaneRegistered = bifrost.panes.alreadyRegistered('CustomServiceTaskEditorPane');

  return isMatchingTaskType && !customPaneRegistered;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesHttpTask key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesHttpTask(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');

  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsHttpServiceTask(element);

  const updateHttpTask = (httpTask: HttpTaskToUpdate): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'httpTask', httpTask);
  };

  const initialValue =
    element.method != null ? selectOptions.find((option) => option.value === element.method) : selectOptions[0];

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
      <PaneProperty
        key={`element_method_${element.method}`}
        htmlId="http-task-method-property"
        label="Method"
        type="select"
        options={selectOptions}
        value={initialValue}
        onChange={(newValue: any) => updateHttpTask({ method: newValue.value })}
      />
      <PaneProperty
        htmlId="http-task-url-property"
        label="Url"
        type="text"
        value={element.url ?? ''}
        onCommit={(newValue: any) => updateHttpTask({ url: newValue })}
      />
      <div className="form-group">
        <label className="d-block">
          Auth Header
          <FeelExpressionHint className="float-right" studio={props.studio} />
        </label>
        <OneLineFeelEditor
          studio={props.studio}
          htmlId="http-task-auth-header-property"
          fontSize={12}
          initialValue={element.authHeader ?? ''}
          onChange={(newValue: any) => updateHttpTask({ authHeader: newValue })}
          variables={feelVariables}
        />
      </div>
      <div className="form-group">
        <label className="d-block">
          Response Headers
          <FeelExpressionHint className="float-right" studio={props.studio} />
        </label>
        <OneLineFeelEditor
          studio={props.studio}
          htmlId="http-task-response-headers-property"
          fontSize={12}
          initialValue={element.responseHeaders ?? ''}
          onChange={(newValue: any) => updateHttpTask({ responseHeaders: newValue })}
          variables={feelVariables}
        />
      </div>
      <div className="form-group">
        <label className="d-block" style={{ width: '100%' }}>
          Body{' '}
          <span className="float-right">
            <FeelExpressionHint studio={props.studio} />
            <OpenInNewTabButton
              studio={props.studio}
              type="bpmn.http-service-task.body"
              parentUri={props.editorDocument.uri}
              fragmentId={element.id}
              dataTest="http-service-task-body-open-in-new-tab"
            />
          </span>
        </label>
        <FeelEditor
          studio={props.studio}
          htmlId="http-task-body-property"
          size="tall"
          fontSize={12}
          initialValue={element.body ?? ''}
          onChange={(value: string) => updateHttpTask({ body: value })}
          variables={feelVariables}
        />
      </div>
    </PaneBody>
  );
}
