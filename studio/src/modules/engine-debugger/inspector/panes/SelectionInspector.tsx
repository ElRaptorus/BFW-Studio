import React from 'react';

import type { EditorDocument, Studio } from '@evil/bifrost_fw_sdk';
import { MultiLineCodeEditor, OpenInNewTabButton } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs';

export type DebuggerSelectionInspectorProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
};

export function DebuggerSelectionInspector(props: DebuggerSelectionInspectorProps): React.JSX.Element {
  const selectedElements = props.model.selectedElements;
  if (selectedElements.length === 0) {
    return <div className="pane__content">Select an Element to inspect its content.</div>;
  }

  const multipleElementsSelected = selectedElements.length > 1;

  const showDataObjectInspector = !multipleElementsSelected && selectedElements[0].type === 'DataObject';
  const showFlowNodeInspector = !multipleElementsSelected && selectedElements[0].type === 'FlowNode';
  const showDefaultInspector = !multipleElementsSelected && !showDataObjectInspector && !showFlowNodeInspector;
  const showMultipleSelectionsInspector = multipleElementsSelected;

  return (
    <>
      {showDefaultInspector && <DefaultSelectionInspector {...props} />}
      {showMultipleSelectionsInspector && <MultipleSelectionsInspector {...props} />}
      {showDataObjectInspector && <DataObjectSelectionInspector {...props} />}
      {showFlowNodeInspector && <FlowNodeSelectionInspector {...props} />}
    </>
  );
}

function DefaultSelectionInspector(props: DebuggerSelectionInspectorProps): React.JSX.Element {
  const selectedElement = props.model.selectedElements[0];

  const stringifiedSelectedElements = JSON.stringify(selectedElement, null, 2);

  const header = `Selected ${selectedElement.shapeType.replace('bpmn:', '')}`;

  return (
    <div className="pane__content debugger-inspector-pane__content--flow-node-props">
      <div className="flow-node-props__information-header">
        <span className="flow-node-props__information-header--text">{header}</span>
        <div className="flow-node-props__information-header--controls">
          <OpenInNewTabButton
            studio={props.studio}
            type="engine-debug.inspector-item"
            parentUri={props.editorDocument.uri}
            fragmentId={`${props.model.processInstance?.id}-selection`}
            additionalData={{
              processInstanceId: props.model.processInstance?.id,
              propertyName: 'Selected Elements',
              value: stringifiedSelectedElements,
            }}
            dataTest="open-inspector-selected-elements-in-new-tab"
          />
        </div>
      </div>
      <MultiLineCodeEditor
        studio={props.studio}
        htmlId="debugger-inspector-selected-elements"
        fontSize={12}
        initialValue={stringifiedSelectedElements}
        readOnly={true}
        language="json"
        minimap={true}
      />
    </div>
  );
}

function MultipleSelectionsInspector(props: DebuggerSelectionInspectorProps): React.JSX.Element {
  return (
    <div className="debugger-inspector-slideshow__container">
      {props.model.selectedElements.map((selectedElement) => {
        const stringifiedSelectedElement = JSON.stringify(selectedElement, null, 2);

        return (
          <div key={selectedElement.id} className="debugger-inspector-slideshow__item">
            <div className="flow-node-props__information-header">
              <span className="flow-node-props__information-header--text">
                {selectedElement.name || selectedElement.id}
              </span>
              <div className="flow-node-props__information-header--controls">
                <OpenInNewTabButton
                  studio={props.studio}
                  type="engine-debug.inspector-item"
                  parentUri={props.editorDocument.uri}
                  fragmentId={`${props.model.processInstance?.id}-selection-${selectedElement.name || selectedElement.id}`}
                  additionalData={{
                    processInstanceId: props.model.processInstance?.id,
                    propertyName: selectedElement.name || selectedElement.id,
                    value: stringifiedSelectedElement,
                  }}
                  dataTest="open-element-in-new-tab"
                />
              </div>
            </div>
            <MultiLineCodeEditor
              studio={props.studio}
              htmlId={`debugger-element-${selectedElement.name || selectedElement.id}`}
              className="debugger-inspector__showroom-monaco-editor"
              fontSize={12}
              initialValue={stringifiedSelectedElement}
              readOnly={true}
              language="json"
              minimap={true}
            />
          </div>
        );
      })}
    </div>
  );
}

function DataObjectSelectionInspector(props: DebuggerSelectionInspectorProps): React.JSX.Element {
  const stringifiedSelectedElements = JSON.stringify(props.model.selectedElements, null, 2);
  const stringifiedSelectedInstance = JSON.stringify(props.model.selectedDataObjectInstance, null, 2);

  return (
    <>
      <div className="data-object-selection-inspector__item data-object-selection-inspector__item--left">
        <div className="flow-node-props__information-header">
          <span className="flow-node-props__information-header--text">Selected Data Object</span>
          <div className="flow-node-props__information-header--controls">
            <OpenInNewTabButton
              studio={props.studio}
              type="engine-debug.inspector-item"
              parentUri={props.editorDocument.uri}
              fragmentId={`${props.model.processInstance?.id}-selected-data-object`}
              additionalData={{
                processInstanceId: props.model.processInstance?.id,
                propertyName: `Data Object ${props.model.selectedDataObjectInstance?.dataObjectId}`,
                value: stringifiedSelectedInstance,
              }}
              dataTest="open-selected-data-object-in-new-tab"
            />
          </div>
        </div>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="debugger-selected-data-object"
          className="debugger-inspector__showroom-monaco-editor"
          fontSize={12}
          initialValue={stringifiedSelectedElements}
          readOnly={true}
          language="json"
          minimap={true}
        />
      </div>
      <div className="data-object-selection-inspector__item data-object-selection-inspector__item--right">
        <div className="flow-node-props__information-header">
          <span className="flow-node-props__information-header--text">Selected Data Object Instance</span>
          <div className="flow-node-props__information-header--controls">
            <OpenInNewTabButton
              studio={props.studio}
              type="engine-debug.inspector-item"
              parentUri={props.editorDocument.uri}
              fragmentId={`${props.model.processInstance?.id}-selected-data-object-instance`}
              additionalData={{
                processInstanceId: props.model.processInstance?.id,
                propertyName: `Data Object Instance ${props.model.selectedDataObjectInstance?.id}`,
                value: stringifiedSelectedInstance,
              }}
              dataTest="open-selected-data-object-instance-in-new-tab"
            />
          </div>
        </div>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="debugger-selected-data-object-instance"
          className="debugger-inspector__showroom-monaco-editor"
          fontSize={12}
          initialValue={stringifiedSelectedInstance}
          readOnly={true}
          language="json"
          minimap={true}
        />
      </div>
    </>
  );
}

function FlowNodeSelectionInspector(props: DebuggerSelectionInspectorProps): React.JSX.Element {
  const flowNodeInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(
    props.model.selectedElements[0] as FlowNode,
  );

  const stringifiedSelectedElements = JSON.stringify(props.model.selectedElements, null, 2);
  const stringifiedSelectedInstance = JSON.stringify(flowNodeInstance, null, 2);

  let tokenHistory = {};
  if (flowNodeInstance != null) {
    tokenHistory = props.model.calculateTokenHistoryForFlowNodeInstance(flowNodeInstance.id);
  }

  const stringifiedTokenHistory = JSON.stringify(tokenHistory, null, 2);

  return (
    <>
      <div className="flow-node-instance-selection-inspector__item flow-node-instance-selection-inspector__item--left">
        <div className="flow-node-props__information-header">
          <span className="flow-node-props__information-header--text">Selected Flow Node</span>
          <div className="flow-node-props__information-header--controls">
            <OpenInNewTabButton
              studio={props.studio}
              type="engine-debug.inspector-item"
              parentUri={props.editorDocument.uri}
              fragmentId={`${props.model.processInstance?.id}-selected-flow-node`}
              additionalData={{
                processInstanceId: props.model.processInstance?.id,
                propertyName: `Flow Node ${flowNodeInstance?.flowNodeId || flowNodeInstance?.flowNodeId}`,
                value: stringifiedSelectedElements,
              }}
              dataTest="open-selected-flow-node-in-new-tab"
            />
          </div>
        </div>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="debugger-selected-flow-node"
          className="debugger-inspector__showroom-monaco-editor"
          fontSize={12}
          initialValue={stringifiedSelectedElements}
          readOnly={true}
          language="json"
          minimap={true}
        />
      </div>
      <div className="flow-node-instance-selection-inspector__item flow-node-instance-selection-inspector__item--center">
        <div className="flow-node-props__information-header">
          <span className="flow-node-props__information-header--text">Selected Flow Node Instance</span>
          <div className="flow-node-props__information-header--controls">
            <OpenInNewTabButton
              studio={props.studio}
              type="engine-debug.inspector-item"
              parentUri={props.editorDocument.uri}
              fragmentId={`${props.model.processInstance?.id}-selected-flow-node-instance`}
              additionalData={{
                processInstanceId: props.model.processInstance?.id,
                propertyName: `Flow Node Instance ${flowNodeInstance?.id}`,
                value: stringifiedSelectedInstance,
              }}
              dataTest="open-selected-flow-node-instance-in-new-tab"
            />
          </div>
        </div>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="debugger-selected-flow-node-instance"
          className="debugger-inspector__showroom-monaco-editor"
          fontSize={12}
          initialValue={stringifiedSelectedInstance}
          readOnly={true}
          language="json"
          minimap={true}
        />
      </div>
      <div className="flow-node-instance-selection-inspector__item flow-node-instance-selection-inspector__item--right">
        <div className="flow-node-props__information-header">
          <span className="flow-node-props__information-header--text">Token History</span>
          <div className="flow-node-props__information-header--controls">
            <OpenInNewTabButton
              studio={props.studio}
              type="engine-debug.inspector-item"
              parentUri={props.editorDocument.uri}
              fragmentId={`${flowNodeInstance?.processInstanceId}-token-history`}
              additionalData={{
                processInstanceId: flowNodeInstance?.processInstanceId,
                propertyName: `Token History for Flow Node Instance ${flowNodeInstance?.id}`,
                value: stringifiedTokenHistory,
              }}
              dataTest="open-inspector-token-history-in-new-tab"
            />
          </div>
        </div>
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId="debugger-inspector-token-history"
          className="debugger-inspector__showroom-monaco-editor"
          fontSize={12}
          initialValue={stringifiedTokenHistory}
          readOnly={true}
          language="json"
          minimap={true}
        />
      </div>
    </>
  );
}
