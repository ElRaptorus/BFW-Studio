import type { Bifrost } from '#bifrost/Bifrost';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';
import { OpenInNewTabButton } from '#components/OpenInNewTabButton';

import React from 'react';

import type BpmnDocumentModel from '../../../BpmnDocumentModel';

export type EditorSelectionInspectorProps = {
  editorDocument: EditorDocument;
  model: BpmnDocumentModel;
  studio: Bifrost;
};

export function EditorSelectionInspector(props: EditorSelectionInspectorProps): React.JSX.Element {
  const selectedElements = props.model.selection.getElements();
  if (selectedElements.length === 0) {
    return <div className="pane__content">Select an Element to inspect its content.</div>;
  }

  return (
    <>
      {selectedElements.length == 1 && <DefaultSelectionInspector {...props} />}
      {selectedElements.length > 1 && <MultipleSelectionsInspector {...props} />}
    </>
  );
}

function DefaultSelectionInspector(props: EditorSelectionInspectorProps): React.JSX.Element {
  const selectedElement = props.model.selection.getOnlyElementOrNull();
  assertNotNull(selectedElement, 'selectedELement');
  const selectedElementFromModeler = props.model.UNSAFE_getSelectionFromModeler();
  const selectedElementBusinessObject = props.model.UNSAFE_getBusinessObjectFromModeler(selectedElement.id);

  const stringifiedSelection = JSON.stringify(selectedElement, null, 2);
  const stringifiedSelectedElementFromModeler = JSON.stringify(selectedElementFromModeler, null, 2);
  const stringifiedSelectedElementBusinessObject = JSON.stringify(selectedElementBusinessObject, null, 2);

  return (
    <>
      <div className="editor-inspector-selection-inspector__item editor-inspector-selection-inspector__item--left">
        <div className="editor-inspector-slideshow__item__information-header">
          <span className="editor-inspector-slideshow__item__information-header--text">
            {selectedElement?.name || selectedElement?.id}
          </span>
          <div className="editor-inspector-slideshow__item__information-header--controls">
            <OpenInNewTabButton
              studio={props.studio}
              type="bpmn.inspector.item"
              parentUri={props.editorDocument.uri}
              fragmentId={`${props.model.getCurrentFilename()}-selection`}
              additionalData={{
                processId: props.model.getCurrentFilename(),
                propertyName: selectedElement?.name || selectedElement?.id,
                value: stringifiedSelection,
              }}
            />
          </div>
        </div>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="editor-inspector-selected-element"
          className="h-100"
          fontSize={12}
          initialValue={stringifiedSelection}
          readOnly={true}
          language="json"
        />
      </div>

      <div className="editor-inspector-selection-inspector__item editor-inspector-selection-inspector__item--center">
        <div className="editor-inspector-slideshow__item__information-header">
          <span className="editor-inspector-slideshow__item__information-header--text">
            Element from Modeler&apos;s selection
          </span>
          <div className="editor-inspector-slideshow__item__information-header--controls">
            <OpenInNewTabButton
              studio={props.studio}
              type="bpmn.inspector.item"
              parentUri={props.editorDocument.uri}
              fragmentId={`${props.model.getCurrentFilename()}-selection`}
              additionalData={{
                processId: props.model.getCurrentFilename(),
                propertyName: `Element from Modeler's selection`,
                value: stringifiedSelectedElementFromModeler,
              }}
            />
          </div>
        </div>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="editor-inspector-selected-element-from-modeler"
          className="h-100"
          fontSize={12}
          initialValue={stringifiedSelectedElementFromModeler}
          readOnly={true}
          language="json"
        />
      </div>

      <div className="editor-inspector-selection-inspector__item editor-inspector-selection-inspector__item--right">
        <div className="editor-inspector-slideshow__item__information-header">
          <span className="editor-inspector-slideshow__item__information-header--text">
            BusinessObject from Modeler&apos;s elementRegistry
          </span>
          <div className="editor-inspector-slideshow__item__information-header--controls">
            <OpenInNewTabButton
              studio={props.studio}
              type="bpmn.inspector.item"
              parentUri={props.editorDocument.uri}
              fragmentId={`${props.model.getCurrentFilename()}-selection`}
              additionalData={{
                processId: props.model.getCurrentFilename(),
                propertyName: `BusinessObject from Modeler's elementRegistry`,
                value: stringifiedSelectedElementBusinessObject,
              }}
            />
          </div>
        </div>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="editor-inspector-selected-element-business-object"
          className="h-100"
          fontSize={12}
          initialValue={stringifiedSelectedElementBusinessObject}
          readOnly={true}
          language="json"
        />
      </div>
    </>
  );
}

function MultipleSelectionsInspector(props: EditorSelectionInspectorProps): React.JSX.Element {
  return (
    <div className="editor-inspector-slideshow__container">
      {props.model.selection.getElements().map((selectedElement) => {
        const stringifiedSelectedElement = JSON.stringify(selectedElement, null, 2);

        return (
          <div key={selectedElement.id} className="editor-inspector-slideshow__item">
            <div className="editor-inspector-slideshow__item__information-header">
              <span className="editor-inspector-slideshow__item__information-header--text">
                {selectedElement.name || selectedElement.id}
              </span>
              <div className="editor-inspector-slideshow__item__information-header--controls">
                <OpenInNewTabButton
                  studio={props.studio}
                  type="bpmn.inspector.item"
                  parentUri={props.editorDocument.uri}
                  fragmentId={`${props.model.getCurrentFilename()}-selection-${selectedElement.name || selectedElement.id}`}
                  additionalData={{
                    processId: props.model.getCurrentFilename(),
                    propertyName: selectedElement.name || selectedElement.id,
                    value: stringifiedSelectedElement,
                  }}
                  dataTest="open-element-in-new-tab"
                />
              </div>
            </div>
            <MultiLineCodeEditor
              studio={props.studio}
              htmlId={`editor-element-${selectedElement.name || selectedElement.id}`}
              className="editor-inspector__showroom-code-editor"
              fontSize={12}
              initialValue={stringifiedSelectedElement}
              readOnly={true}
              language="json"
            />
          </div>
        );
      })}
    </div>
  );
}
