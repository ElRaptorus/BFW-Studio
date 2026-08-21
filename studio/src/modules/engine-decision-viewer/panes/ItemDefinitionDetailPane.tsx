import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty, assertNotNull } from '@evil/bifrost_fw_sdk';

import type { DmnItemDefinition } from '../types/dmnModelTypes';
import { getParsedModel, getSelection, isDecisionViewerDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'ItemDefinition Detail';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isDecisionViewerDocument(editorDocument)) {
    return false;
  }
  return getSelection(editorDocumentModel)?.type === 'itemDefinition';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const selection = getSelection(props.editorDocumentModel);
  assertNotNull(selection, 'selection');

  const parsedModel = getParsedModel(props.editorDocumentModel);
  assertNotNull(parsedModel, 'parsedModel');

  const itemDefinition = parsedModel.itemDefinitions.find((entry) => entry.id === selection.elementId);
  assertNotNull(itemDefinition, 'itemDefinition');

  return <ItemDefinitionContent itemDefinition={itemDefinition} depth={0} />;
}

function ItemDefinitionContent(props: { itemDefinition: DmnItemDefinition; depth: number }): React.JSX.Element {
  const { itemDefinition, depth } = props;
  const indent = depth * 12;

  return (
    <div className="engine-pane-item-definition" style={{ paddingLeft: indent }}>
      <PaneProperty type="text" label="Name" value={itemDefinition.name} disabled />
      <PaneProperty type="text" label="ID" value={itemDefinition.id} disabled />
      <PaneProperty type="text" label="Type Ref" value={itemDefinition.typeRef ?? '—'} disabled />
      {itemDefinition.isCollection && <PaneProperty type="text" label="Collection" value="Yes" disabled />}
      {itemDefinition.allowedValues && (
        <PaneProperty type="text" label="Allowed Values" value={itemDefinition.allowedValues} disabled />
      )}

      {itemDefinition.itemComponents.length > 0 && (
        <div className="engine-pane-item-definition__components">
          <div className="engine-pane-item-definition__section-title">Item Components</div>
          {itemDefinition.itemComponents.map((component) => (
            <ItemDefinitionContent key={component.id} itemDefinition={component} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
