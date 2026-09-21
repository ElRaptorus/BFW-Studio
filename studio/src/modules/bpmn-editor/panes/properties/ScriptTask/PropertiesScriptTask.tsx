import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { FeelExpressionHint } from '#components/FeelExpressionHint';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useEffect, useState } from 'react';

import type { FeelEditorVariable } from '@elraptorus/bfw_studio_sdk';
import { FeelEditor, PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { assertBpmnElementIsScriptTask } from '../../BpmnElementTypeAssertionFunctions';
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

const SCRIPT_TASK_HELP_ID = 'bpmn/properties/script_task';

function getPaneTitle(): string {
  return 'Script Task';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element | null {
  const bifrost = props.studio;
  const editorDocument = props.editorDocument;

  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }

  const selectedElement = selection[0];

  const openScriptIcon = (
    <OpenInNewTabButton
      studio={bifrost}
      type="bpmn.script"
      parentUri={editorDocument.uri}
      fragmentId={selectedElement.id}
      id="script-task-open-script-tab"
    />
  );

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <span className="pane-header__icon">
          <FeelExpressionHint studio={props.studio} />
        </span>
        <span className="pane-header__divider"></span>
        {openScriptIcon}
        <PaneHeaderHelpIcon studio={bifrost} id={SCRIPT_TASK_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.ScriptTask);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesScriptTask key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesScriptTask(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;
  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertBpmnElementIsScriptTask(element);

  const scriptRef = element.scriptRef ?? '';
  const hasScriptRef = scriptRef.trim().length > 0;
  const scriptFormat = bpmnDocumentModel.elements.getElementPropertyValue(element.id, 'scriptFormat') as
    string | undefined;

  const updateScript = (newScript: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'script', newScript);
  };

  const updateScriptRef = (newScriptRef: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'script', {
      script: element.script,
      scriptRef: newScriptRef,
    });
  };

  const updateScriptFormat = (newScriptFormat: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'scriptFormat', newScriptFormat);
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
      <PaneProperty
        key={`script_task_script_ref_${scriptRef}`}
        label="Script Ref"
        type="text"
        htmlId="script-task-script-ref-property"
        placeholder="Plugin key..."
        value={scriptRef}
        searchQuery={editorDocument.metadata.searchQuery}
        onCommit={(value: string) => updateScriptRef(value)}
        htmlAttributes={{ 'data-test--script-task-script-ref-property': true }}
      />
      <PaneProperty
        key={`script_task_script_format_${scriptFormat ?? ''}`}
        label="Script Format"
        type="text"
        htmlId="script-task-script-format-property"
        placeholder="Optional format identifier..."
        value={scriptFormat ?? ''}
        searchQuery={editorDocument.metadata.searchQuery}
        onCommit={(value: string) => updateScriptFormat(value)}
        htmlAttributes={{ 'data-test--script-task-script-format-property': true }}
      />
      {hasScriptRef ? (
        <div className="form-group">
          <span>Script dispatched to plugin: {scriptRef}</span>
        </div>
      ) : (
        <div className="form-group">
          <label className="d-block" style={{ width: '100%' }}>
            Script
            <span className="float-right">
              <FeelExpressionHint studio={props.studio} />
            </span>
          </label>
          <FeelEditor
            htmlId="script-task-input"
            size="tall"
            fontSize={12}
            initialValue={element.script ?? ''}
            onChange={(value: string) => updateScript(value)}
            variables={feelVariables}
          />
        </div>
      )}
    </PaneBody>
  );
}
