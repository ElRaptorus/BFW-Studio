import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { FeelExpressionHint } from '#components/FeelExpressionHint';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { BpmnElementType } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useEffect, useState } from 'react';

import type { FeelEditorVariable } from '@evil/bifrost_fw_sdk';
import { FeelEditor, PaneProperty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

// The engine evaluates the completion condition against a small, dedicated binding set
// (`build_adhoc_completion_bindings/1`) — NOT the standard token/context/this bindings. Unlike
// Active Elements (which uses the full standard FEEL context), mixing in the standard bindings
// here would be misleading since they are not actually available at runtime for this expression.
const ADHOC_COMPLETION_CONDITION_VARIABLES: FeelEditorVariable[] = [
  {
    name: 'performedActivities',
    type: 'variable',
    detail: 'number',
    info: 'Number of inner activities that have finished so far.',
  },
  {
    name: 'activeCount',
    type: 'variable',
    detail: 'number',
    info: 'Number of inner activities currently active or waiting.',
  },
  {
    name: 'totalActivities',
    type: 'variable',
    detail: 'number',
    info: 'Total number of inner activities defined in the ad-hoc sub-process.',
  },
];

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Ad-hoc Sub-Process';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/adhoc_subprocess" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.AdHocSubprocess);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesAdHocSubprocess key={getKeyForPropertiesPane(selection)} {...props} />;
}

function PropertiesAdHocSubprocess(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel = props.editorDocumentModel as BpmnDocumentModel;
  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const ordering = (element as any).ordering ?? 'Parallel';
  const cancelRemainingInstances = (element as any).cancelRemainingInstances ?? true;
  const completionCondition = (element as any).completionCondition ?? '';
  const implementation = (element as any).implementation ?? '';
  const activeElementsExpression = (element as any).activeElementsExpression ?? '';

  const changeOrdering = (option: { value: string }): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'adHocSubprocess', {
      ordering: option.value,
    });
  };

  const changeCancelRemainingInstances = (option: { value: string }): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'adHocSubprocess', {
      cancelRemainingInstances: option.value === 'true',
    });
  };

  const changeCompletionCondition = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'adHocSubprocess', {
      completionCondition: value,
    });
  };

  const changeImplementation = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'adHocSubprocess', {
      implementation: value,
    });
  };

  const changeActiveElementsExpression = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'adHocSubprocess', {
      activeElementsExpression: value,
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
      <PaneProperty
        key={`adhoc_subprocess_ordering_${ordering}`}
        type="select"
        label="Ordering"
        value={
          ordering === 'Sequential'
            ? { label: 'Sequential', value: 'Sequential' }
            : { label: 'Parallel', value: 'Parallel' }
        }
        onChange={changeOrdering}
        htmlId="adhoc-subprocess-ordering-property"
        options={[
          { label: 'Parallel', value: 'Parallel', dataTestOptionValue: 'Parallel' },
          { label: 'Sequential', value: 'Sequential', dataTestOptionValue: 'Sequential' },
        ]}
      />
      <PaneProperty
        key={`adhoc_subprocess_cancel_remaining_${cancelRemainingInstances}`}
        type="select"
        label="Cancel Remaining Instances"
        value={
          cancelRemainingInstances
            ? { label: 'Yes (interrupt on completion)', value: 'true' }
            : { label: 'No (drain naturally)', value: 'false' }
        }
        onChange={changeCancelRemainingInstances}
        htmlId="adhoc-subprocess-cancel-remaining-property"
        options={[
          { label: 'Yes (interrupt on completion)', value: 'true', dataTestOptionValue: 'true' },
          { label: 'No (drain naturally)', value: 'false', dataTestOptionValue: 'false' },
        ]}
      />
      <PaneProperty
        type="text"
        label="Implementation"
        placeholder="(engine-managed when empty)"
        value={implementation}
        onCommit={changeImplementation}
        htmlId="adhoc-subprocess-implementation-property"
        htmlAttributes={{ 'data-test--adhoc-subprocess-implementation-input': true }}
      />
      <div className="form-group">
        <label className="d-block" style={{ width: '100%' }}>
          Active Elements
          <span className="float-right">
            <FeelExpressionHint studio={props.studio} />
          </span>
        </label>
        <FeelEditor
          htmlId="adhoc-subprocess-active-elements-property"
          initialValue={activeElementsExpression}
          size="medium"
          fontSize={12}
          onChange={(value) => changeActiveElementsExpression(value)}
          variables={feelVariables}
          htmlAttributes={{ 'data-test--adhoc-subprocess-active-elements-input': true }}
        />
      </div>
      <div className="form-group">
        <label className="d-block" style={{ width: '100%' }}>
          Completion Condition
          <span className="float-right">
            <FeelExpressionHint studio={props.studio} />
          </span>
        </label>
        <FeelEditor
          htmlId="adhoc-subprocess-completion-condition-property"
          initialValue={completionCondition}
          size="medium"
          fontSize={12}
          onChange={(value) => changeCompletionCondition(value)}
          variables={ADHOC_COMPLETION_CONDITION_VARIABLES}
          htmlAttributes={{ 'data-test--adhoc-subprocess-completion-condition-input': true }}
        />
      </div>
    </PaneBody>
  );
}
