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
  return 'Input Collection';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element | null {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <FeelExpressionHint studio={props.studio} />
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/multi_instance_input" />
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
  const inputDataItem = loopConfig?.kind === 'multiInstance' ? (loopConfig.inputDataItem ?? '') : '';
  const inputCollection = loopConfig?.kind === 'multiInstance' ? (loopConfig.inputCollection ?? '') : '';
  const elementVariable = loopConfig?.kind === 'multiInstance' ? (loopConfig.elementVariable ?? '') : '';

  const changeInputDataItem = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateMultiInstance',
      inputDataItem: value,
    });
  };

  const changeInputCollection = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateMultiInstance',
      inputCollection: value,
    });
  };

  const changeElementVariable = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'loopConfig', {
      command: 'updateMultiInstance',
      elementVariable: value,
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
        label="Input Data Item"
        value={inputDataItem}
        onCommit={changeInputDataItem}
        htmlId="mi-input-data-item-property"
        htmlAttributes={{ 'data-test--mi-input-collection-input': true }}
      />
      <div className="form-group">
        <label className="d-block">
          Input Collection
          <FeelExpressionHint className="float-right" studio={props.studio} />
        </label>
        <FeelEditor
          studio={props.studio}
          initialValue={inputCollection}
          size="medium"
          fontSize={12}
          onChange={(value) => changeInputCollection(value)}
          variables={feelVariables}
          htmlAttributes={{ 'data-test--mi-evil-input-collection-input': true }}
        />
      </div>
      <PaneProperty
        type="text"
        label="Element Variable"
        value={elementVariable}
        placeholder="e.g. item"
        onCommit={changeElementVariable}
        htmlId="mi-element-variable-property"
        htmlAttributes={{ 'data-test--mi-element-variable-input': true }}
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
