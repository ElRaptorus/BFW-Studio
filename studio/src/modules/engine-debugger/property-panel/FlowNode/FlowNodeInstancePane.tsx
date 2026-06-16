import { PaneLoadingWrapper } from '#modules/engine-core';
import { getHumanizedDateTime, getShortId } from '#modules/engine-core/Formatters';
import Select from 'react-select';

import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, SelectOption, Studio } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { hasMultiInstance } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayFlowNodeInstanceInfoPane } from '../ShouldBeDisplayedConditions';

type FlowNodeInstancePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Studio;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayFlowNodeInstanceInfoPane,
  Pane: PaneFull,
  PaneContent: FlowNodeInstancePane,
};

function getPaneTitle(): string {
  return 'Flow Node Instance';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && (
        <FlowNodeInstancePane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function FlowNodeInstancePane(props: FlowNodeInstancePaneProps): React.JSX.Element | null {
  const selectedFlowNodeInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(props.flowNode);
  const flowNodeModel = props.flowNode.flowNodeModel;

  return (
    <PaneLoadingWrapper isLoading={false}>
      <PaneBody>
        {flowNodeModel != null && hasMultiInstance(flowNodeModel) ? (
          <p className="text-muted">Multi-instance iterations share the flow node instance selector below.</p>
        ) : null}
        <FlowNodeInstanceSelector {...props} />
        <PaneProperty type="text" label="Flow Node Instance ID" disabled={true} value={selectedFlowNodeInstance.id} />
        <PaneProperty type="text" label="State" disabled={true} value={selectedFlowNodeInstance.state} />
        <PaneProperty
          type="text"
          label="Started At"
          disabled={true}
          value={getHumanizedDateTime(selectedFlowNodeInstance.startedAt)}
        />
        <PaneProperty
          type="text"
          label="Finished At"
          disabled={true}
          value={selectedFlowNodeInstance.finishedAt ? getHumanizedDateTime(selectedFlowNodeInstance.finishedAt) : ''}
        />
      </PaneBody>
    </PaneLoadingWrapper>
  );
}

function FlowNodeInstanceSelector(props: FlowNodeInstancePaneProps): React.JSX.Element {
  const flowNodeInstanceStateColors: Record<string, string> = {
    active: '#54C8FF',
    waiting: '#2185D0',
    finished: '#18B918',
    fatal: '#FF0101',
    aborted: '#E66E00',
    interrupted: '#64647D',
  };

  const flowNodeInstances = props.flowNode.flowNodeInstances;

  const flowNodeInstanceSelectOptions: SelectOption[] = flowNodeInstances.map((flowNodeInstance) => {
    const iconStyle = {
      '--icon-primary-color': flowNodeInstanceStateColors[flowNodeInstance.state] ?? '#64647D',
      '--icon-secondary-color': '#fff',
    } as React.CSSProperties;

    const label = getShortId(flowNodeInstance.id);

    return {
      label: (
        <div className="flow-node-instance-selector__item">
          <div className="flow-node-instance-selector__item--icon" style={iconStyle}>
            <Icon id="bpmn/element/color" />
          </div>
          <div className="flow-node-instance-selector__item--label">
            {label}
            <div className="flow-node-instance-selector__item--sublabel">
              {getHumanizedDateTime(flowNodeInstance.startedAt)}
            </div>
          </div>
        </div>
      ),
      value: flowNodeInstance.id,
    };
  });

  const selectedFlowNodeInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(props.flowNode);

  const initialValue = flowNodeInstanceSelectOptions.find((entry) => entry.value === selectedFlowNodeInstance.id);

  const selectContainerHeightAdjustment = {
    valueContainer: (provided: Record<string, unknown>) => ({
      ...provided,
      alignItems: 'stretch',
      height: '40px',
    }),
  };

  return (
    <div className="form-group">
      <label className="d-block">Flow Node Instance</label>
      <Select
        styles={selectContainerHeightAdjustment}
        isSearchable={false}
        name="flow-node-instances-list"
        className="react-select"
        classNamePrefix="react-select"
        options={flowNodeInstanceSelectOptions}
        value={initialValue}
        onChange={(selectedOption: SelectOption | null) => {
          if (selectedOption?.value) {
            props.model.selectFlowNodeInstance(String(selectedOption.value));
          }
        }}
      />
    </div>
  );
}
