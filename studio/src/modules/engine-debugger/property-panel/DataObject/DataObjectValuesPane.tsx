import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { getHumanizedDateTime, getShortId } from '#modules/engine-core/Formatters';
import Select from 'react-select';

import React from 'react';

import type { FlowNodeInstance } from '@elraptorus/bfw_engine_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getFlowNodeById } from '../../libs/BpmnProcessHelpers';
import type { DataObject } from '../../libs/index';
import { CopyableJsonDataRenderer } from '../CopyableJsonDataRenderer';
import { FlowNodeInstanceLink } from '../FlowNodeInstanceLinks';
import { shouldDisplayDataObjectValuesPane } from '../ShouldBeDisplayedConditions';

export type DataObjectValuePaneProps = {
  dataObject: DataObject;
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayDataObjectValuesPane,
  Pane: PaneFull,
  PaneContent: DataObjectValuePane,
};

function getPaneTitle(): string {
  return 'Data Object Value History';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const selectedElement = model.selectedElements[0] as DataObject;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && (
        <DataObjectValuePane
          editorDocument={props.editorDocument}
          dataObject={selectedElement}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function DataObjectValuePane(props: DataObjectValuePaneProps): React.JSX.Element | null {
  const selectedDataObjectInstance = props.model.getSelectedDataObjectInstanceByDataObject(props.dataObject);

  const initialValueSelected = selectedDataObjectInstance.id === 'initial-value';

  const referencedFlowNodeInstance = props.model.flowNodeInstances.find(
    (flowNodeInstance) => flowNodeInstance.id === selectedDataObjectInstance.flowNodeInstanceId,
  ) as FlowNodeInstance | undefined;

  const referencedFlowNode =
    referencedFlowNodeInstance && props.model.processModel
      ? getFlowNodeById(props.model.processModel, referencedFlowNodeInstance.flowNodeId)
      : undefined;

  const connectingAssociation = referencedFlowNode?.dataOutputAssociations.find(
    (association) => association.targetRef === props.dataObject.id,
  );

  return (
    <PaneBody>
      <DataObjectValueSelector {...props}></DataObjectValueSelector>
      <div className="form-group">
        <CopyableJsonDataRenderer
          editorDocument={props.editorDocument}
          id={selectedDataObjectInstance.id}
          flowNodeId={props.dataObject.id}
          flowNodeName={props.dataObject.name}
          key={`${props.dataObject.id}-${selectedDataObjectInstance.id}-expression`}
          language="json"
          propertyName="Value"
          studio={props.studio}
          value={selectedDataObjectInstance.value}
        />
        <PaneProperty
          type="text"
          label="Created At"
          disabled={true}
          value={getHumanizedDateTime(selectedDataObjectInstance.createdAt)}
        />
      </div>
      {!initialValueSelected && referencedFlowNodeInstance && (
        <>
          <div className="form-group">
            <label className="d-block">Created by Flow Node Instance </label>
            <FlowNodeInstanceLink
              key={`flow_node_instance_link_${referencedFlowNodeInstance.id}`}
              iconComponent={Icon}
              model={props.model}
              targetFlowNodeName={referencedFlowNodeInstance.flowNodeId}
              targetFlowNodeId={referencedFlowNodeInstance.flowNodeId}
              targetFlowNodeInstanceId={referencedFlowNodeInstance.id}
              targetFlowNodeType={referencedFlowNodeInstance.flowNodeType}
              targetFlowNodeEventType={referencedFlowNodeInstance.eventType ?? undefined}
            />
          </div>
          {connectingAssociation?.valueExpression && (
            <CopyableJsonDataRenderer
              editorDocument={props.editorDocument}
              id={selectedDataObjectInstance.id}
              flowNodeId={props.dataObject.id}
              flowNodeName={props.dataObject.name}
              key={`${props.dataObject.id}-${selectedDataObjectInstance.id}-content`}
              language="javascript"
              propertyName="Data Source Expression"
              studio={props.studio}
              value={connectingAssociation.valueExpression}
            />
          )}
        </>
      )}
    </PaneBody>
  );
}

function DataObjectValueSelector(props: DataObjectValuePaneProps): React.JSX.Element {
  const selectableDataObjectInstances = props.model.getSelectableDataObjectInstancesByDataObject(props.dataObject);
  const options = selectableDataObjectInstances.map((dataObject) => {
    return {
      label: (
        <div className="flow-node-instance-selector__item">
          <div className="flow-node-instance-selector__item--label">
            {dataObject.id === 'initial-value' ? 'Initial Value' : getShortId(dataObject.id)}
            <div className="flow-node-instance-selector__item--sublabel">
              {getHumanizedDateTime(dataObject.createdAt)}
            </div>
          </div>
        </div>
      ),
      value: dataObject.id,
    };
  });

  const selectedDataObjectInstance = props.model.getSelectedDataObjectInstanceByDataObject(props.dataObject);
  const selectedOption = options.find((option) => option.value === selectedDataObjectInstance.id);

  const selectContainerHeightAdjustment = {
    valueContainer: (provided) => ({
      ...provided,
      alignItems: 'stretch',
      height: '40px',
    }),
  };

  return (
    <div className="form-group">
      <Select
        styles={selectContainerHeightAdjustment}
        name="state"
        className="react-select"
        classNamePrefix="react-select"
        options={options}
        value={selectedOption}
        onChange={(selectedOption: { value: string } | null) => {
          if (!selectedOption) {
            return;
          }
          if (selectedOption.value === 'initial-value') {
            props.model.selectDataObjectInstance(selectedOption.value);
            return;
          }
          props.model.selectFlowNodeInstance(selectedOption.value);
        }}
      />
    </div>
  );
}
