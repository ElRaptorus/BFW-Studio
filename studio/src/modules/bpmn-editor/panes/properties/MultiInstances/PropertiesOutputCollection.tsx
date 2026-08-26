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
  return 'Output Collection';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element | null {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <FeelExpressionHint studio={props.studio} />
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/multi_instance_output" />
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
  const outputDataItem = loopConfig?.kind === 'multiInstance' ? (loopConfig.outputDataItem ?? '') : '';
  const outputCollection = loopConfig?.kind === 'multiInstance' ? (loopConfig.outputCollection ?? '') : '';
  const outputElementVariable = loopConfig?.kind === 'multiInstance' ? (loopConfig.outputElementVariable ?? '') : '';

  const changeOutputDataItem = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateMultiInstance',
      outputDataItem: value,
    });
  };

  const changeOutputCollection = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateMultiInstance',
      outputCollection: value,
    });
  };

  const changeOutputElementVariable = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateMultiInstance',
      outputElementVariable: value,
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
        type="text"
        label="Output Data Item"
        value={outputDataItem}
        onCommit={changeOutputDataItem}
        htmlId="mi-output-data-item-property"
        htmlAttributes={{ 'data-test--mi-output-collection-input': true }}
      />
      <div className="form-group">
        <label className="d-block">
          Output Collection
          <FeelExpressionHint className="float-right" studio={props.studio} />
        </label>
        <FeelEditor
          initialValue={outputCollection}
          size="medium"
          fontSize={12}
          onChange={(value) => changeOutputCollection(value)}
          variables={feelVariables}
          htmlAttributes={{ 'data-test--mi-evil-output-collection-input': true }}
        />
      </div>
      <PaneProperty
        type="text"
        label="Output Element Variable"
        value={outputElementVariable}
        placeholder="e.g. processedItem"
        onCommit={changeOutputElementVariable}
        htmlId="mi-output-element-variable-property"
        htmlAttributes={{ 'data-test--mi-output-element-variable-input': true }}
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
