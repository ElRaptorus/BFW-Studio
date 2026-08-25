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
  return 'Table Outputs';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!shouldBeDisplayedForDmnViewType(editorDocument, editorDocumentModel, 'decisionTable')) {
    return false;
  }
  const model = getDmnModel(editorDocumentModel);
  const decisionTable = model?.elements.getActiveViewDecisionTable();
  const outputs = decisionTable ? model!.elements.getDecisionTableOutputs(decisionTable) : [];
  return outputs.length > 0;
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

  return <TableOutputsProperties key={getActiveViewElementKey(model)} {...props} />;
}

function TableOutputsProperties(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const decisionTable = model.elements.getActiveViewDecisionTable();
  if (!decisionTable) {
    return null;
  }

  const outputs = model.elements.getDecisionTableOutputs(decisionTable);

  return (
    <PaneBody>
      {outputs.map((output: any, index: number) => {
        const name = output.name ?? '';
        const typeRef = output.typeRef ?? '';
        const outputValues = output.outputValues?.text ?? '';
        const defaultOutputEntry = output.defaultOutputEntry?.text ?? '';

        return (
          <div key={output.id} data-test--dmn-dt-output={output.id}>
            <PaneProperty
              label={`Output ${index + 1}: Name`}
              type="text"
              value={name}
              disabled={true}
              htmlAttributes={{ 'data-test--dmn-dt-output-name': output.id }}
            />
            <PaneProperty
              label={`Output ${index + 1}: Type`}
              type="text"
              value={typeRef}
              disabled={true}
              htmlAttributes={{ 'data-test--dmn-dt-output-type': output.id }}
            />
            {outputValues !== '' && (
              <PaneProperty
                label={`Output ${index + 1}: Allowed Values`}
                type="text"
                value={outputValues}
                disabled={true}
                htmlAttributes={{ 'data-test--dmn-dt-output-values': output.id }}
              />
            )}
            {defaultOutputEntry !== '' && (
              <PaneProperty
                label={`Output ${index + 1}: Default`}
                type="text"
                value={defaultOutputEntry}
                disabled={true}
                htmlAttributes={{ 'data-test--dmn-dt-output-default': output.id }}
              />
            )}
          </div>
        );
      })}
    </PaneBody>
  );
}
