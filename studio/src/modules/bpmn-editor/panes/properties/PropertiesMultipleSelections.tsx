import React from 'react';

import type { EditorDocument, IconComponent, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { BpmnElementColorPicker, Icon, Pane, PaneBody, PaneHeader, generateRandomColor } from '@evil/bifrost_fw_sdk';

import type BpmnDocumentModel from '../../BpmnDocumentModel';
import { getBpmnSelectionForPropertiesPane } from '../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Selected Elements';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
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

  return selection.length > 1;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as BpmnDocumentModel;
  const selection = getBpmnSelectionForPropertiesPane(props);
  const defaultCustomColor = {
    backgroundColor: generateRandomColor(),
    borderColor: generateRandomColor(),
  };

  if (selection == null || selection.length <= 1) {
    return null;
  }

  const onElementColorChange = (newValue: any): void => {
    const colorOrString = newValue.value;
    selection.forEach((element) => {
      if (colorOrString === 'custom') {
        /**
         * We have to keep this in mind when letting the user define colors himself.
         * If someone defines a color that happens to correspond to this color,
         * we will only be able to change it to "custom" by deleting it first.
         */
        model.elements.setColor(element.id, {
          backgroundColor: defaultCustomColor.backgroundColor,
          borderColor: defaultCustomColor.borderColor,
        });
      } else if (colorOrString === 'no_color') {
        model.elements.setColor(element.id, null);
      } else {
        model.elements.setColor(element.id, newValue.value);
      }
    });
  };

  const setBackgroundColor = (backgroundColor: string): void => {
    selection.forEach((element) => {
      model.elements.setBackgroundColor(element.id, backgroundColor);
    });
  };

  const setBorderColor = (borderColor: string): void => {
    selection.forEach((element) => {
      model.elements.setBorderColor(element.id, borderColor);
    });
  };

  const multipleColorsSet =
    selection
      .map((element) => model.elements.getColor(element.id))
      .filter(
        (color, index, self) =>
          self.findIndex(
            (color2) =>
              color2?.borderColor === color?.borderColor && color2?.backgroundColor === color?.backgroundColor,
          ) === index,
      ).length > 1;

  let initialColor = !multipleColorsSet ? model.elements.getColor(selection[0].id) : undefined;

  if (initialColor === null) {
    initialColor = {
      label: 'no_color',
    } as any;
  }

  return (
    <PaneBody>
      {selection.map((selection) => {
        return (
          <SelectedElementLink
            key={`selected_element_link_${selection.id}`}
            iconComponent={Icon}
            model={model}
            name={selection.name}
            id={selection.id}
          />
        );
      })}

      <hr />

      <BpmnElementColorPicker
        initialColor={initialColor}
        onElementColorChange={onElementColorChange}
        setBorderColor={setBorderColor}
        setBackgroundColor={setBackgroundColor}
        placeholder="Multiple Colors"
        studio={props.studio}
      />
    </PaneBody>
  );
}

type SelectedElementLinkProps = {
  iconComponent: IconComponent;
  model: BpmnDocumentModel;
  id: string;
  name?: string;
};

function SelectedElementLink(props: SelectedElementLinkProps): React.JSX.Element {
  const Icon = props.iconComponent;

  return (
    <div
      className="pane-item pane-item--hoverable"
      onClick={(): void => {
        props.model.selection.selectElement(props.id);
      }}
    >
      <div className="pane-item__text">
        {props.id}
        <div className="pane-item__sublabel">{props.name}</div>
      </div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}
