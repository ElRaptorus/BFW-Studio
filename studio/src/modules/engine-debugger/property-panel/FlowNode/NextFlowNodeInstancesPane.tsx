import React, { useMemo } from 'react';

import type { PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs';
import { FlowNodeInstanceLink } from '../FlowNodeInstanceLinks';
import { shouldDisplayNextFlowNodeInstancesPane } from '../ShouldBeDisplayedConditions';

export type NextFlowNodeInstancesPaneProps = {
  model: EngineBpmnDebuggerEditorDocumentModel;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayNextFlowNodeInstancesPane,
  Pane: PaneFull,
  PaneContent: NextFlowNodeInstancesPane,
};

function getPaneTitle(): string {
  return 'Next Flow Node Instances';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {!props.collapsed && <NextFlowNodeInstancesPane model={props.editorDocumentModel} />}
    </Pane>
  );
}

function NextFlowNodeInstancesPane({ model }: NextFlowNodeInstancesPaneProps): React.JSX.Element | null {
  const selectedFlowNode = model.selectedElements[0] as FlowNode;
  const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(selectedFlowNode);
  const selectedFniId = selectedFlowNodeInstance.id;
  const allFniIds = model.flowNodeInstances.map((fni) => fni.id).join(',');

  const flowNodeInstances = useMemo(() => {
    const id = selectedFlowNodeInstance.id;
    const multiInstanceMetadataId = selectedFlowNodeInstance.id;

    return model.flowNodeInstances.filter((fni) => {
      if (!fni.previousFlowNodeInstanceIds) {
        return false;
      }

      const flowNodeInstanceIdFound = fni.previousFlowNodeInstanceIds.includes(id);
      if (!multiInstanceMetadataId) {
        return flowNodeInstanceIdFound;
      }

      const multiInstanceMetadataIdFound = fni.previousFlowNodeInstanceIds.includes(multiInstanceMetadataId);

      return flowNodeInstanceIdFound || multiInstanceMetadataIdFound;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFlowNodeInstance, model.flowNodeInstances, selectedFniId, allFniIds]);

  return (
    <PaneBody>
      {flowNodeInstances.map((fni) => (
        <FlowNodeInstanceLink
          key={`flow_node_instance_link_${fni.id}`}
          iconComponent={Icon}
          model={model}
          targetFlowNodeName={fni.flowNodeId}
          targetFlowNodeId={fni.flowNodeId}
          targetFlowNodeInstanceId={fni.id}
          targetFlowNodeType={fni.flowNodeType}
          targetFlowNodeEventType={fni.eventType ?? undefined}
        />
      ))}
    </PaneBody>
  );
}
