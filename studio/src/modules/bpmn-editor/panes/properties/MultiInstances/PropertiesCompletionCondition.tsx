import React, { useEffect, useState } from 'react';

import type { EditorDocument, FeelEditorVariable, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import {
  FeelEditor,
  FeelExpressionHint,
  Pane,
  PaneBody,
  PaneHeader,
  PaneHeaderHelpIcon,
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
  return 'Completion Condition';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element | null {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <FeelExpressionHint studio={props.studio} />
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/multi_instance_completion" />
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
  const completionCondition = loopConfig?.kind === 'multiInstance' ? (loopConfig.completionCondition ?? '') : '';

  const changeCompletionCondition = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateMultiInstance',
      completionCondition: value,
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
      <FeelEditor
        studio={props.studio}
        initialValue={completionCondition}
        size="medium"
        fontSize={12}
        onChange={(value) => changeCompletionCondition(value)}
        variables={feelVariables}
        htmlAttributes={{ 'data-test--mi-completion-condition-input': true }}
      />
    </PaneBody>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  const isActivity = isActivityType(editorDocument, editorDocumentModel);
  const loopCharacteristics = getLoopCharacteristicType(editorDocumentModel);

  return (
    isActivity &&
    (loopCharacteristics === LoopCharacteristics.Sequential || loopCharacteristics === LoopCharacteristics.Parallel)
  );
}
