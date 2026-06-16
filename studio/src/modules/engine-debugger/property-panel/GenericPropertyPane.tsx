import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../EngineBpmnDebuggerEditorDocumentModel';
import type { GenericElement } from '../libs/index';
import { shouldDisplayGenericPane } from './ShouldBeDisplayedConditions';

type GenericPropertyPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  selectedElement: GenericElement;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayGenericPane,
  Pane: PaneFull,
  PaneContent: GenericPropertyPane,
};

function getPaneTitle(
  editorDocument: EditorDocument,
  editorDocumentModel: EngineBpmnDebuggerEditorDocumentModel,
): string {
  const selectedElement = editorDocumentModel.selectedElements[0] as GenericElement;

  switch (selectedElement.shapeType) {
    case 'bpmn:DataStoreReference':
      return 'Data Store';
    case 'bpmn:TextAnnotation':
      return 'Text Annotation';
    case 'bpmn:Association':
      return 'Association';
    case 'bpmn:MessageFlow':
      return 'Message Flow';
    case 'bpmn:Collaboration':
      return 'Collaboration';
    case 'bpmn:Lane':
      return 'Lane';
    case 'bpmn:Group':
      return 'Group';
    case 'label':
      return 'Label';
    default:
      return 'Basic Properties';
  }
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const selectedElement = model.selectedElements[0] as GenericElement;

  return (
    <Pane>
      <PaneHeader
        studio={props.studio}
        title={getPaneTitle(props.editorDocument, props.editorDocumentModel)}
        paneId={props.paneId}
        collapsed={props.collapsed}
      />
      {props.collapsed !== true && (
        <GenericPropertyPane
          editorDocument={props.editorDocument}
          selectedElement={selectedElement}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function GenericPropertyPane(props: GenericPropertyPaneProps): React.JSX.Element {
  return (
    <PaneBody>
      <PaneProperty type="text" label="Element ID" disabled={true} value={props.selectedElement.id || ''} />
      <PaneProperty type="text" label="Element Name" disabled={true} value={props.selectedElement.name || ''} />
    </PaneBody>
  );
}
