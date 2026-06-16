import React, { useEffect, useState } from 'react';

import type { EditorDocument, FeelEditorVariable, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import {
  FeelEditor,
  FeelExpressionHint,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
  PaneProperty,
  assertNotNull,
} from '@evil/bifrost_fw_sdk';
import { LoopCharacteristics } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

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
        <label className="d-block" style={{ width: '100%' }}>
          Loop Condition{' '}
          <span className="float-right">
            <FeelExpressionHint studio={props.studio} />
          </span>
        </label>
        <FeelEditor
          studio={props.studio}
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
    </PaneBody>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  const isActivity = isActivityType(editorDocument, editorDocumentModel);
  const loopCharacteristics = getLoopCharacteristicType(editorDocumentModel);

  return isActivity && loopCharacteristics === LoopCharacteristics.Loop;
}
