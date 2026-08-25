import React, { useCallback, useState } from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty } from '@evil/bifrost_fw_sdk';

import type DmnDocumentModel from '../../../DmnDocumentModel';
import { getDmnModel, shouldBeDisplayedForDmnDrdNoSelection } from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Item Definitions';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  return shouldBeDisplayedForDmnDrdNoSelection(editorDocument, editorDocumentModel);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="dmn/item-definitions" />
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

  return <ItemDefinitionsContent {...props} />;
}

function ItemDefinitionsContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as DmnDocumentModel;
  const [refreshKey, setRefreshKey] = useState(0);

  const itemDefinitions: any[] = model.elements.getItemDefinitions();

  const refresh = useCallback(() => setRefreshKey((previous) => previous + 1), []);

  const addItemDefinition = useCallback(() => {
    const name = `NewType_${Date.now().toString(36)}`;
    model.elements.addItemDefinition({ name, typeRef: 'string' });
    refresh();
  }, [model, refresh]);

  const removeItemDefinition = useCallback(
    (itemDef: any) => {
      model.elements.removeItemDefinition(itemDef);
      refresh();
    },
    [model, refresh],
  );

  const updateItemDefinition = useCallback(
    (itemDef: any, propertyName: string, value: any) => {
      model.elements.updateItemDefinition(itemDef, propertyName, value);
      refresh();
    },
    [model, refresh],
  );

  return (
    <PaneBody key={refreshKey}>
      {itemDefinitions.length === 0 && (
        <div className="dmn-item-definitions__empty" data-test--dmn-item-definitions-empty={true}>
          No item definitions defined.
        </div>
      )}

      {itemDefinitions.map((itemDef: any) => (
        <ItemDefinitionEntry
          key={itemDef.id}
          itemDefinition={itemDef}
          onUpdate={updateItemDefinition}
          onRemove={removeItemDefinition}
        />
      ))}

      <div className="dmn-item-definitions__actions" data-test--dmn-item-definitions-actions={true}>
        <button
          type="button"
          className="dmn-item-definitions__add-button"
          onClick={addItemDefinition}
          data-test--dmn-item-definitions-add={true}
        >
          + Add Item Definition
        </button>
      </div>
    </PaneBody>
  );
}

type ItemDefinitionEntryProps = {
  itemDefinition: any;
  onUpdate: (itemDef: any, propertyName: string, value: any) => void;
  onRemove: (itemDef: any) => void;
};

function ItemDefinitionEntry(props: ItemDefinitionEntryProps): React.JSX.Element {
  const { itemDefinition, onUpdate, onRemove } = props;
  const itemComponents: any[] = itemDefinition.itemComponent ?? [];
  const isComposite = itemComponents.length > 0;
  const typeDisplay = isComposite ? `composite (${itemComponents.length} components)` : (itemDefinition.typeRef ?? '');
  const collectionLabel = itemDefinition.isCollection === true ? 'Yes' : 'No';

  return (
    <div
      className="dmn-item-definitions__entry"
      data-test--dmn-item-definition-entry={itemDefinition.name ?? itemDefinition.id}
    >
      <PaneProperty
        label="Name"
        type="text"
        value={itemDefinition.name ?? ''}
        onCommit={(value: any) => onUpdate(itemDefinition, 'name', value)}
        htmlAttributes={{ 'data-test--dmn-item-definition-name': true }}
      />
      {!isComposite && (
        <PaneProperty
          label="Type"
          type="text"
          value={itemDefinition.typeRef ?? ''}
          onCommit={(value: any) => onUpdate(itemDefinition, 'typeRef', value)}
          htmlAttributes={{ 'data-test--dmn-item-definition-type': true }}
        />
      )}
      {isComposite && (
        <PaneProperty
          label="Type"
          type="text"
          value={typeDisplay}
          disabled={true}
          htmlAttributes={{ 'data-test--dmn-item-definition-type': true }}
        />
      )}
      <PaneProperty
        label="Collection"
        type="select"
        value={{ label: collectionLabel, value: collectionLabel }}
        options={[
          { label: 'No', value: 'No' },
          { label: 'Yes', value: 'Yes' },
        ]}
        onChange={(selected: any) => {
          const isCollection = (selected?.value ?? selected) === 'Yes';
          onUpdate(itemDefinition, 'isCollection', isCollection);
        }}
        htmlId={`dmn-item-definition-collection-${itemDefinition.id}`}
      />

      {isComposite && (
        <div className="dmn-item-definitions__components" data-test--dmn-item-definition-components={true}>
          <div className="dmn-item-definitions__components-header">Components:</div>
          {itemComponents.map((component: any) => (
            <div key={component.id} className="dmn-item-definitions__component">
              <span className="dmn-item-definitions__component-info">
                {component.name ?? '(unnamed)'}: {component.typeRef ?? '(no type)'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="dmn-item-definitions__entry-actions">
        <button
          type="button"
          className="dmn-item-definitions__remove-button"
          onClick={() => onRemove(itemDefinition)}
          data-test--dmn-item-definition-remove={true}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
