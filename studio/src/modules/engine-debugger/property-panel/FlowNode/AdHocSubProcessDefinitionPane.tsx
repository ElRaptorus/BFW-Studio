import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { SubProcessTypeData } from '@elraptorus/daemonengine_sdk';
import { FlowNodeInstanceState } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getAdHocInnerActivities, getChildProcessInstanceId } from '../../libs/BpmnProcessHelpers';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayAdHocSubProcessInstancePane } from '../ShouldBeDisplayedConditions';

export type AdHocSubProcessDefinitionPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayAdHocSubProcessInstancePane,
  Pane: PaneFull,
  PaneContent: AdHocSubProcessDefinitionPane,
};

function getPaneTitle(): string {
  return 'Ad-hoc Sub-Process';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/adhoc_subprocess" />
      </PaneHeader>
      {props.collapsed !== true && <AdHocSubProcessDefinitionPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

type ActivityStatus = 'not yet performed' | 'active' | 'waiting' | 'completed' | 'failed';

function resolveActivityStatus(states: FlowNodeInstanceState[]): ActivityStatus {
  if (states.length === 0) {
    return 'not yet performed';
  }
  if (states.some((state) => state === FlowNodeInstanceState.Active)) {
    return 'active';
  }
  if (states.some((state) => state === FlowNodeInstanceState.Waiting)) {
    return 'waiting';
  }
  if (
    states.some(
      (state) =>
        state === FlowNodeInstanceState.Fatal ||
        state === FlowNodeInstanceState.Error ||
        state === FlowNodeInstanceState.Aborted,
    )
  ) {
    return 'failed';
  }
  if (
    states.every((state) => state === FlowNodeInstanceState.Finished || state === FlowNodeInstanceState.Interrupted)
  ) {
    return 'completed';
  }
  return 'not yet performed';
}

function AdHocSubProcessDefinitionPane(props: AdHocSubProcessDefinitionPaneProps): React.JSX.Element {
  const flowNode = props.model.selectedElements[0] as FlowNode;
  const adHocModel = flowNode.flowNodeModel;
  const typeData = adHocModel?.typeData as SubProcessTypeData | undefined;
  const shellFni = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode);

  const typeProperties = (shellFni.typeProperties as Record<string, unknown> | null) ?? {};
  const activationCount = Number(typeProperties['activationCount'] ?? 0);
  const totalActivations = typeProperties['totalActivations'] as number | undefined;
  const completionReason = typeProperties['completionReason'] as string | undefined;

  const childProcessInstanceId = getChildProcessInstanceId(shellFni);
  const innerActivities = adHocModel ? getAdHocInnerActivities(adHocModel) : [];

  const innerFnis = childProcessInstanceId
    ? props.model.flowNodeInstances.filter((fni) => fni.processInstanceId === childProcessInstanceId)
    : [];

  return (
    <PaneBody>
      <PaneProperty type="text" label="Ordering" disabled={true} value={typeData?.adhocOrdering ?? 'Parallel'} />
      <PaneProperty
        type="text"
        label="Completion Condition"
        disabled={true}
        value={typeData?.adhocCompletionCondition ?? '(all activities performed)'}
      />
      <PaneProperty
        type="text"
        label="Cancel Remaining Instances"
        disabled={true}
        value={typeData?.cancelRemainingInstances ? 'Yes' : 'No'}
      />
      {typeData?.implementation && (
        <PaneProperty
          type="text"
          label="Implementation (plugin-managed)"
          disabled={true}
          value={typeData.implementation}
        />
      )}
      <PaneProperty
        type="text"
        label="Total Activations"
        disabled={true}
        value={String(totalActivations ?? activationCount)}
      />
      {completionReason && (
        <PaneProperty type="text" label="Completion Reason" disabled={true} value={completionReason} />
      )}

      <hr />
      <p className="text-muted mb-2">Inner Activities</p>
      {innerActivities.length === 0 && <p className="text-muted">No activities defined.</p>}
      {innerActivities.map((activity) => {
        const activityFnis = innerFnis.filter((fni) => fni.flowNodeId === activity.id);
        const status = resolveActivityStatus(activityFnis.map((fni) => fni.state));
        return (
          <PaneProperty
            key={activity.id}
            type="text"
            label={activity.name ?? activity.id}
            disabled={true}
            value={`${status} (${activityFnis.length}x)`}
          />
        );
      })}
    </PaneBody>
  );
}
