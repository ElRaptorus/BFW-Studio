import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import React, { useMemo } from 'react';

import type { PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs';
import { FlowNodeInstanceLink } from '../FlowNodeInstanceLinks';
import { shouldDisplayPreviousFlowNodeInstancesPane } from '../ShouldBeDisplayedConditions';

export type PreviousFlowNodeInstancesPaneProps = {
  model: EngineBpmnDebuggerEditorDocumentModel;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayPreviousFlowNodeInstancesPane,
  Pane: PaneFull,
  PaneContent: PreviousFlowNodeInstancesPane,
};

function getPaneTitle(): string {
  return 'Previous Flow Node Instances';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {!props.collapsed && <PreviousFlowNodeInstancesPane model={props.editorDocumentModel} />}
    </Pane>
  );
}

function PreviousFlowNodeInstancesPane({ model }: PreviousFlowNodeInstancesPaneProps): React.JSX.Element | null {
  const selectedFlowNode = model.selectedElements[0] as FlowNode;
  const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(selectedFlowNode);

  const flowNodeInstances = useMemo(() => {
    const lookup = new Map(model.flowNodeInstances.map((instance) => [instance.id, instance]));
    return selectedFlowNodeInstance.previousFlowNodeInstanceIds
      .map((instanceId) => lookup.get(instanceId))
      .filter((instance): instance is FlowNodeInstance => instance != null);
  }, [selectedFlowNodeInstance, model.flowNodeInstances]);

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
