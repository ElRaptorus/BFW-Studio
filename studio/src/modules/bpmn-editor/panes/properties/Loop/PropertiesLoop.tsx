import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { FeelExpressionHint } from '#components/FeelExpressionHint';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import { LoopCharacteristics } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useEffect, useState } from 'react';

import type { FeelEditorVariable } from '@evil/bifrost_fw_sdk';
import { FeelEditor, PaneProperty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { getLoopCharacteristicType, isActivityType } from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Loop Configuration';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element | null {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/loop" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bpmnDocumentModel: BpmnDocumentModel = props.editorDocumentModel;
  const element = bpmnDocumentModel.selection.getOnlyElementOrNull();
  assertNotNull(element, 'element');

  const loopConfig = element.loopConfig;
  const loopCondition = loopConfig?.kind === 'standard' ? (loopConfig.loopCondition ?? '') : '';
  const loopMaximum = loopConfig?.kind === 'standard' ? (loopConfig.loopMaximum ?? '') : '';
  const testBefore = loopConfig?.kind === 'standard' ? (loopConfig.testBefore ?? false) : false;
  const loopInterval = loopConfig?.kind === 'standard' ? (loopConfig.loopInterval ?? '') : '';

  const changeLoopCondition = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateStandardLoop',
      loopCondition: value,
    });
  };

  const changeLoopMaximum = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateStandardLoop',
      loopMaximum: value,
    });
  };

  const changeTestBefore = (option: { value: string }): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateStandardLoop',
      testBefore: option.value === 'true',
    });
  };

  const changeLoopInterval = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateStandardLoop',
      loopInterval: value,
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
        type="select"
        label="Evaluation Mode"
        value={
          testBefore
            ? { label: 'While-Do (test before)', value: 'true' }
            : { label: 'Do-While (test after)', value: 'false' }
        }
        onChange={changeTestBefore}
        htmlId="loop-test-before-property"
        options={[
          { label: 'Do-While (test after)', value: 'false', dataTestOptionValue: 'false' },
          { label: 'While-Do (test before)', value: 'true', dataTestOptionValue: 'true' },
        ]}
      />
      <div className="form-group">
        <label className="d-block" style={{ width: '100%' }}>
          Loop Condition{' '}
          <span className="float-right">
            <FeelExpressionHint studio={props.studio} />
          </span>
        </label>
        <FeelEditor
          initialValue={loopCondition}
          size="tall"
          fontSize={12}
          onChange={(value) => changeLoopCondition(value)}
          variables={feelVariables}
          htmlAttributes={{ 'data-test--loop-condition-input': true }}
        />
      </div>
      <PaneProperty
        type="text"
        label="Max Iterations"
        value={loopMaximum}
        onCommit={changeLoopMaximum}
        htmlId="loop-max-iterations-property"
        htmlAttributes={{ 'data-test--loop-max-iterations-input': true }}
      />
      <PaneProperty
        type="text"
        label="Loop Interval"
        value={loopInterval}
        placeholder="e.g. PT30S"
        onCommit={changeLoopInterval}
        htmlId="loop-interval-property"
        htmlAttributes={{ 'data-test--loop-interval-input': true }}
      />
    </PaneBody>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  const isActivity = isActivityType(editorDocument, editorDocumentModel);
  const loopCharacteristics = getLoopCharacteristicType(editorDocumentModel);

  return isActivity && loopCharacteristics === LoopCharacteristics.Loop;
}
