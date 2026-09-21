import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneLoadingWrapper } from '#modules/engine-core';
import { getHumanizedDateTime, getShortId } from '#modules/engine-core/Formatters';
import Select from 'react-select';

import React from 'react';

import { PaneProperty, type SelectOption } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getShortMultiInstanceId } from '../../libs/formattersCompat';
import type { FlowNode, MultiInstanceGroup } from '../../libs/index';
import { shouldDisplayFlowNodeInstanceInfoPane } from '../ShouldBeDisplayedConditions';

type FlowNodeInstancePaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
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
  const miGroups = props.flowNode.multiInstanceGroups;
  const hasMiGroups = miGroups.length > 0;

  return (
    <PaneLoadingWrapper isLoading={false}>
      <PaneBody>
        {hasMiGroups ? <MultiInstanceSelector {...props} groups={miGroups} /> : <FlowNodeInstanceSelector {...props} />}
        <PaneProperty type="text" label="Flow Node Instance ID" disabled={true} value={selectedFlowNodeInstance.id} />
        <PaneProperty type="text" label="State" disabled={true} value={selectedFlowNodeInstance.state} />
        {selectedFlowNodeInstance.iterationIndex != null && (
          <PaneProperty
            type="text"
            label="Iteration Index"
            disabled={true}
            value={String(selectedFlowNodeInstance.iterationIndex)}
          />
        )}
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

const FLOW_NODE_INSTANCE_STATE_COLORS: Record<string, string> = {
  active: '#54C8FF',
  waiting: '#2185D0',
  finished: '#18B918',
  fatal: '#FF0101',
  aborted: '#DAA800',
  interrupted: '#64647D',
  error: '#DC5028',
};

const selectContainerHeightAdjustment = {
  valueContainer: (provided: Record<string, unknown>) => ({
    ...provided,
    alignItems: 'stretch',
    height: '40px',
  }),
};

function MultiInstanceSelector(props: FlowNodeInstancePaneProps & { groups: MultiInstanceGroup[] }): React.JSX.Element {
  const { groups, model, flowNode } = props;
  const selectedFni = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);
  const selectedMiId = model.selectedMultiInstanceId;

  const activeGroup =
    groups.find((group) => group.shellFni.id === selectedMiId) ??
    groups.find(
      (group) => group.shellFni.id === selectedFni.id || group.iterationFnis.some((iter) => iter.id === selectedFni.id),
    ) ??
    groups[groups.length - 1];

  let loopLabel = 'Parallel MI';
  if (activeGroup.loopType === 'standard_loop') {
    loopLabel = 'Standard Loop';
  } else if (activeGroup.loopType === 'sequential_mi') {
    loopLabel = 'Sequential MI';
  }

  const shellOptions: SelectOption[] = groups.map((group, index) => {
    const finishedCount = group.iterationFnis.filter((fni) => fni.state === 'finished').length;
    const totalCount = group.iterationFnis.length;
    const shellLabel = `Shell #${index + 1} (${finishedCount}/${totalCount} iterations, ${group.shellFni.state})`;
    return { label: shellLabel, value: group.shellFni.id };
  });

  const iterationOptions: SelectOption[] = [
    { label: `${loopLabel} Shell — ${activeGroup.shellFni.state}`, value: activeGroup.shellFni.id },
    ...activeGroup.iterationFnis.map((fni) => {
      const iconStyle = {
        '--icon-primary-color': FLOW_NODE_INSTANCE_STATE_COLORS[fni.state] ?? '#64647D',
        '--icon-secondary-color': '#fff',
      } as React.CSSProperties;

      return {
        label: (
          <div className="flow-node-instance-selector__item">
            <div className="flow-node-instance-selector__item--icon" style={iconStyle}>
              <Icon id="bpmn/element/color" />
            </div>
            <div className="flow-node-instance-selector__item--label">
              Iteration {fni.iterationIndex ?? '?'} — {getShortMultiInstanceId(fni.id)}
              <div className="flow-node-instance-selector__item--sublabel">
                {fni.state} • {getHumanizedDateTime(fni.startedAt)}
              </div>
            </div>
          </div>
        ),
        value: fni.id,
      };
    }),
  ];

  const selectedShellOption = shellOptions.find((opt) => opt.value === activeGroup.shellFni.id);
  const selectedIterationOption = iterationOptions.find((opt) => opt.value === selectedFni.id) ?? iterationOptions[0];

  return (
    <>
      {groups.length > 1 && (
        <div className="form-group">
          <label className="d-block">{loopLabel} Shell</label>
          <Select
            styles={selectContainerHeightAdjustment}
            isSearchable={false}
            name="mi-shell-selector"
            className="react-select"
            classNamePrefix="react-select"
            options={shellOptions}
            value={selectedShellOption}
            onChange={(selectedOption: SelectOption | null) => {
              if (selectedOption?.value) {
                model.selectMultiInstance(String(selectedOption.value));
              }
            }}
          />
        </div>
      )}
      <div className="form-group">
        <label className="d-block">{groups.length <= 1 ? `${loopLabel} — ` : ''}Iteration</label>
        <Select
          styles={selectContainerHeightAdjustment}
          isSearchable={false}
          name="mi-iteration-selector"
          className="react-select"
          classNamePrefix="react-select"
          options={iterationOptions}
          value={selectedIterationOption}
          onChange={(selectedOption: SelectOption | null) => {
            if (selectedOption?.value) {
              model.selectFlowNodeInstance(String(selectedOption.value));
            }
          }}
        />
      </div>
    </>
  );
}

function FlowNodeInstanceSelector(props: FlowNodeInstancePaneProps): React.JSX.Element {
  const flowNodeInstances = props.flowNode.flowNodeInstances;

  const flowNodeInstanceSelectOptions: SelectOption[] = flowNodeInstances.map((flowNodeInstance) => {
    const iconStyle = {
      '--icon-primary-color': FLOW_NODE_INSTANCE_STATE_COLORS[flowNodeInstance.state] ?? '#64647D',
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
