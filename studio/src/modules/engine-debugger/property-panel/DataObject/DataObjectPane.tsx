import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon, PaneProperty, assertNotNull } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { DataObject } from '../../libs/index';
import { JumpToSymbolInSolutionLink } from '../JumpToSymbolInSolutionLink';
import { shouldDisplayDataObjectInfoPane } from '../ShouldBeDisplayedConditions';

export type DataObjectPaneProps = {
  dataObject: DataObject;
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayDataObjectInfoPane,
  Pane: PaneFull,
  PaneContent: DataObjectPane,
};

function getPaneTitle(): string {
  return 'Data Object';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const dataObject = model.selectedElements[0] as DataObject;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/data_object" />
      </PaneHeader>
      {props.collapsed !== true && (
        <DataObjectPane dataObject={dataObject} editorDocument={props.editorDocument} model={model} studio={studio} />
      )}
    </Pane>
  );
}

function DataObjectPane(props: DataObjectPaneProps): React.JSX.Element {
  const dataObject = props.dataObject;

  return (
    <PaneBody>
      <DataObjectPropertiesRenderer {...props}></DataObjectPropertiesRenderer>
      {props.model.getSelectableDataObjectInstancesByDataObject(dataObject).length === 0 && (
        <p>Data Object does not contain any data.</p>
      )}
    </PaneBody>
  );
}

function DataObjectPropertiesRenderer(props: DataObjectPaneProps): React.JSX.Element {
  assertNotNull(props.model.processInstance, 'props.model.processInstance');

  const dataObject = props.dataObject;

  return (
    <>
      <label>
        Data Object ID{' '}
        <JumpToSymbolInSolutionLink
          definitionId={props.model.processInstance.processModelId ?? ''}
          elementId={dataObject.id ?? ''}
          studio={props.studio}
        />
      </label>
      <PaneProperty type="text" disabled={true} value={dataObject.id ?? ''} />
      <PaneProperty type="text" label="Data Object Name" disabled={true} value={dataObject.name ?? ''} />
    </>
  );
}
