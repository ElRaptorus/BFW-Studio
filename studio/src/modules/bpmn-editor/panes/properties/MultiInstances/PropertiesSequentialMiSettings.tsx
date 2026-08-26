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
import { OneLineFeelEditor, PaneProperty } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import { getLoopCharacteristicType, isActivityType } from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Sequential Iteration Settings';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element | null {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <FeelExpressionHint studio={props.studio} />
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/sequential_mi_settings" />
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
  const loopBreakCondition = loopConfig?.kind === 'multiInstance' ? (loopConfig.loopBreakCondition ?? '') : '';
  const loopInterval = loopConfig?.kind === 'multiInstance' ? (loopConfig.loopInterval ?? '') : '';
  const maxIterations = loopConfig?.kind === 'multiInstance' ? (loopConfig.maxIterations ?? '') : '';

  const changeLoopBreakCondition = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateMultiInstance',
      loopBreakCondition: value,
    });
  };

  const changeLoopInterval = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateMultiInstance',
      loopInterval: value,
    });
  };

  const changeMaxIterations = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateMultiInstance',
      maxIterations: value,
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
          Loop Break Condition
          <FeelExpressionHint className="float-right" studio={props.studio} />
        </label>
        <OneLineFeelEditor
          initialValue={loopBreakCondition}
          onChange={(value: string) => changeLoopBreakCondition(value)}
          variables={feelVariables}
          htmlId="seq-mi-loop-break-condition-property"
          htmlAttributes={{ 'data-test--seq-mi-loop-break-condition-input': true }}
        />
      </div>
      <PaneProperty
        type="text"
        label="Loop Interval"
        placeholder="e.g. PT5S"
        value={loopInterval}
        onCommit={changeLoopInterval}
        htmlId="seq-mi-loop-interval-property"
        htmlAttributes={{ 'data-test--seq-mi-loop-interval-input': true }}
      />
      <PaneProperty
        type="text"
        label="Max Iterations"
        value={maxIterations}
        onCommit={changeMaxIterations}
        htmlId="seq-mi-max-iterations-property"
        htmlAttributes={{ 'data-test--seq-mi-max-iterations-input': true }}
      />
    </PaneBody>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  const isActivity = isActivityType(editorDocument, editorDocumentModel);
  const loopCharacteristics = getLoopCharacteristicType(editorDocumentModel);

  return isActivity && loopCharacteristics === LoopCharacteristics.Sequential;
}
