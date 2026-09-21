import { assertNotNull } from '#bifrost/common/AssertionFunctions';
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
import { FeelEditor } from '@elraptorus/bfw_studio_sdk';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';
import {
  getBpmnSelectionForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Transformation';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element | null {
  const { studio } = props;

  const editorDocument = props.editorDocument;

  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }

  const selectedElement = selection[0];

  const openTransformationTabIcon = (
    <OpenInNewTabButton
      studio={studio}
      type="bpmn.data-output-association.transformation"
      parentUri={editorDocument.uri}
      fragmentId={selectedElement.id}
      id="transformation-open-tab"
      dataTest="open-transformation-in-new-tab"
    />
  );

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <span className="pane-header__icon">
          <FeelExpressionHint studio={props.studio} />
        </span>
        <span className="pane-header__divider"></span>
        {openTransformationTabIcon}
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/data_output_association_transformation" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(
    editorDocument,
    editorDocumentModel,
    BpmnElementType.DataOutputAssociation,
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;
  const element = bpmnDocumentModel?.selection.getOnlyElementOrNull();

  const [feelVariables, setFeelVariables] = useState<FeelEditorVariable[]>([]);
  const { editorDocument } = props;
  const { commands } = props.studio;
  useEffect(() => {
    commands
      .executeCommand<Promise<FeelEditorVariable[]>>('bpmn.feel.getExpressionContext', [editorDocument])
      .then(setFeelVariables);
  }, [editorDocument, commands]);

  assertNotNull(bpmnDocumentModel, 'bpmnDocumentModel');
  assertNotNull(element, 'element');

  const transformationValue = (element as any).transformation ?? '';

  const changeTransformation = (value: string): void => {
    bpmnDocumentModel.elements.setElementProperty(element.id, 'transformation', value);
  };

  return (
    <PaneBody key={element.id}>
      <FeelEditor
        initialValue={transformationValue}
        htmlId="data-output-association-data-source-input"
        size="tall"
        fontSize={12}
        onChange={(value) => changeTransformation(value)}
        variables={feelVariables}
      />
    </PaneBody>
  );
}
