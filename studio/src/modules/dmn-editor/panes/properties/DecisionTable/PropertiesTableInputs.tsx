import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { getActiveViewElementKey, getDmnModel, shouldBeDisplayedForDmnViewType } from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Table Inputs';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!shouldBeDisplayedForDmnViewType(editorDocument, editorDocumentModel, 'decisionTable')) {
    return false;
  }
  const model = getDmnModel(editorDocumentModel);
  const decisionTable = model?.elements.getActiveViewDecisionTable();
  const inputs = decisionTable ? model!.elements.getDecisionTableInputs(decisionTable) : [];
  return inputs.length > 0;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/decision-tables" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = getDmnModel(props.editorDocumentModel);
  if (!model || !model.isReadyForInteraction()) {
    return null;
  }

  return <TableInputsProperties key={getActiveViewElementKey(model)} {...props} />;
}

function TableInputsProperties(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const decisionTable = model.elements.getActiveViewDecisionTable();
  if (!decisionTable) {
    return null;
  }

  const inputs = model.elements.getDecisionTableInputs(decisionTable);

  return (
    <PaneBody>
      {inputs.map((input: any, index: number) => {
        const inputExpression = input.inputExpression;
        const label = input.label ?? inputExpression?.text ?? '';
        const typeRef = inputExpression?.typeRef ?? '';
        const inputValues = input.inputValues?.text ?? '';

        return (
          <div key={input.id ?? index} data-test--dmn-dt-input={input.id}>
            <PaneProperty
              label={`Input ${index + 1}: Expression`}
              type="text"
              value={label}
              disabled={true}
              htmlAttributes={{ 'data-test--dmn-dt-input-expression': input.id }}
            />
            <PaneProperty
              label={`Input ${index + 1}: Type`}
              type="text"
              value={typeRef}
              disabled={true}
              htmlAttributes={{ 'data-test--dmn-dt-input-type': input.id }}
            />
            {inputValues !== '' && (
              <PaneProperty
                label={`Input ${index + 1}: Allowed Values`}
                type="text"
                value={inputValues}
                disabled={true}
                htmlAttributes={{ 'data-test--dmn-dt-input-values': input.id }}
              />
            )}
          </div>
        );
      })}
    </PaneBody>
  );
}
