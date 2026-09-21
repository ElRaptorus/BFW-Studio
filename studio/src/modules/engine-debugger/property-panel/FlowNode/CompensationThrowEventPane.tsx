import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayCompensationThrowEventPane } from '../ShouldBeDisplayedConditions';

type CompensationThrowEventPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayCompensationThrowEventPane,
  Pane: PaneFull,
  PaneContent: CompensationThrowEventPane,
};

function getPaneTitle(): string {
  return 'Compensation Trigger';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && (
        <CompensationThrowEventPane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function CompensationThrowEventPane(props: CompensationThrowEventPaneProps): React.JSX.Element {
  const { model, flowNode } = props;
  const selectedFni = model.getSelectedFlowNodeInstanceByFlowNode(flowNode);

  const typeProperties = selectedFni?.typeProperties as Record<string, unknown> | null;
  const throwType = typeProperties?.['compensation_throw_type'] as string | undefined;
  const activityRef = typeProperties?.['compensation_activity_ref'] as string | undefined;

  const compensatedActivities = model.compensatedActivities.filter((entry) => entry.throwFniId === selectedFni?.id);

  const isTargeted = activityRef != null && activityRef.length > 0;

  return (
    <PaneBody>
      <PaneProperty
        type="text"
        label="Throw Type"
        disabled={true}
        value={throwType === 'end' ? 'End Event (terminates path)' : 'Intermediate (continues)'}
      />
      <PaneProperty
        type="text"
        label="Target"
        disabled={true}
        value={isTargeted ? activityRef : 'Broadcast (all completed activities)'}
      />
      <PaneProperty
        type="text"
        label="Compensated Activities"
        disabled={true}
        value={String(compensatedActivities.length)}
      />
      {compensatedActivities.map((entry, index) => (
        <PaneProperty
          key={entry.handlerFniId}
          type="text"
          label={`Handler ${index + 1}`}
          disabled={true}
          value={entry.handlerActivityId}
        />
      ))}
    </PaneBody>
  );
}
