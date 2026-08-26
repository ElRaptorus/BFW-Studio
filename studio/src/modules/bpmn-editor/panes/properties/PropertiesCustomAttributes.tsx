import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Checkbox } from '#components/Checkbox';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { BpmnElementCustomProperty } from '#modules/bpmn-editor/BpmnElementTypes';

import React from 'react';

import { FormInput } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../BpmnDocumentModel';

type CustomPropertyProps = {
  index: number;
  property: BpmnElementCustomProperty;
  showInternalCustomProperties: boolean;
  changeCustomPropertyName: (index: number, name: string) => void;
  changeCustomPropertyValue: (index: number, value: string) => void;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Custom properties';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={bifrost} id="bpmn/properties/custom_attributes" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument == null || editorDocument.modelKey !== 'BpmnDocumentModel' || editorDocumentModel == null) {
    return false;
  }

  const bpmnDocumentModel: BpmnDocumentModel = editorDocumentModel as BpmnDocumentModel;
  const selection = bpmnDocumentModel.selection.getElements();

  return selection.length === 1;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const bifrost = props.studio;
  const editorDocument: EditorDocument = props.editorDocument;
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;

  if (
    editorDocument == null ||
    editorDocument.modelKey != 'BpmnDocumentModel' ||
    bpmnDocumentModel == null ||
    !bpmnDocumentModel.isReadyForInteraction()
  ) {
    return null;
  }

  const selection = bpmnDocumentModel.selection.getElements();

  if (selection.length != 1) {
    return null;
  }

  const selectedElement = selection[0];
  if (selectedElement == null) {
    return null;
  }

  const properties = bpmnDocumentModel.elements.getCustomProperties(selectedElement.id) || [];

  const changeCustomPropertyName = (index: number, name: string): void =>
    bpmnDocumentModel.elements.setCustomPropertyName(selectedElement.id, index, name);
  const changeCustomPropertyValue = (index: number, value: string): void =>
    bpmnDocumentModel.elements.setCustomPropertyValue(selectedElement.id, index, value);
  properties.push({ name: '', value: '' });

  const knownInternalProperties = bifrost.commands.executeCommand(
    'bpmn.customProperties.getInternalPropertiesByBpmnElementType',
    [selectedElement.type],
  );

  const presentCustomProperties = properties.map((property) => property.name);
  const nonInternalCustomProperties = presentCustomProperties.filter(
    (presentCustomProperty) => !knownInternalProperties.includes(presentCustomProperty),
  );

  const showInternalCustomProperties = bifrost.settings.get('bpmn.editor.showInternalCustomProperties');
  const toggleInternalCustomProperties = () =>
    bifrost.settings.set('bpmn.editor.showInternalCustomProperties', !showInternalCustomProperties);

  const shownProperties = showInternalCustomProperties
    ? properties
    : properties.filter((property) => nonInternalCustomProperties.includes(property.name));

  return (
    <PaneBody>
      {properties.map((property: BpmnElementCustomProperty, index: number) => {
        if (shownProperties.includes(property)) {
          return (
            <CustomProperty
              key={property.name}
              index={index}
              property={property}
              showInternalCustomProperties={showInternalCustomProperties}
              changeCustomPropertyName={changeCustomPropertyName}
              changeCustomPropertyValue={changeCustomPropertyValue}
            />
          );
        }

        return null;
      })}
      <Checkbox
        checked={showInternalCustomProperties}
        onChange={toggleInternalCustomProperties}
        label="Show internal custom properties"
      />
    </PaneBody>
  );
}

function CustomProperty(props: CustomPropertyProps): React.JSX.Element {
  return (
    <div className="form-row" key={`custom-property-${props.index}-${props.showInternalCustomProperties}`}>
      <div className="form-group col">
        <FormInput
          htmlId={`custom-property-${props.index}-name`}
          key={`name-${props.index}-${props.property.name}`}
          type="text"
          className="form-control form-control-sm col"
          placeholder="Name"
          value={props.property.name}
          onCommit={(value: any) => props.changeCustomPropertyName(props.index, value)}
        />
      </div>
      <div className="form-group col-5">
        <FormInput
          htmlId={`custom-property-${props.index}-value`}
          key={`value-${props.index}-${props.property.value}`}
          type="text"
          className="form-control form-control-sm col"
          placeholder="Value"
          value={props.property.value}
          onCommit={(value: any) => props.changeCustomPropertyValue(props.index, value)}
        />
      </div>
    </div>
  );
}
