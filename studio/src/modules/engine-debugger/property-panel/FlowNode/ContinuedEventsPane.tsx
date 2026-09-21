import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React, { useEffect, useState } from 'react';

import { FlowNodeType } from '@elraptorus/bfw_engine_sdk';
import type { FlowNodeInstance } from '@elraptorus/bfw_engine_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { resolveFlowNodeIconForDebugger } from '../../libs/flowNodeDisplay';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayThrowingMessageOrSignalOrEscalationEventPane } from '../ShouldBeDisplayedConditions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayThrowingMessageOrSignalOrEscalationEventPane,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Continued Flow Node Instances';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  const selectedFlowNodeInstance = model.getSelectedFlowNodeInstanceByFlowNode(flowNode) as FlowNodeInstance;

  return (
    <ContinuedEventsPane
      editorDocument={props.editorDocument}
      flowNode={flowNode}
      model={props.editorDocumentModel}
      selectedFlowNodeInstance={selectedFlowNodeInstance}
      studio={studio}
    />
  );
}

type ContinuedEventsPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
  flowNode: FlowNode;
  selectedFlowNodeInstance: FlowNodeInstance;
};

function ContinuedEventsPane(props: ContinuedEventsPaneProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [continuedEvents, setContinuedEvents] = useState<FlowNodeInstance[] | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    async function fetchData(): Promise<void> {
      const events = await props.model.getEventsContinuedByFlowNodeInstance(props.selectedFlowNodeInstance.id);

      if (mounted) {
        setLoading(false);
        setContinuedEvents(events as FlowNodeInstance[]);
      }
    }

    fetchData();
    return () => {
      mounted = false;
    };
  }, [props.model, props.selectedFlowNodeInstance.id]);

  if (loading === true) {
    return <PaneBody>Loading...</PaneBody>;
  }

  if (!continuedEvents || continuedEvents.length === 0) {
    if (props.selectedFlowNodeInstance.flowNodeType === FlowNodeType.SendTask) {
      return <PaneBody>No Flow Node Instances were continued by this Task.</PaneBody>;
    }
    return <PaneBody>No Flow Node Instances were continued by this Event.</PaneBody>;
  }

  const onClick = (eventInstance: FlowNodeInstance): void => {
    props.studio.commands.executeCommand('engine.debugger.focusOrOpen', [
      props.model.engineUrl,
      eventInstance.processInstanceId,
      eventInstance.id,
    ]);
  };

  return (
    <PaneBody>
      {continuedEvents.map((eventInstance) => {
        return (
          <div
            key={`triggered-event-instance-link_${eventInstance.id}`}
            className="pane-item pane-item--hoverable"
            onClick={() => onClick(eventInstance)}
          >
            <div className="pane-item__squared-rounded-icon" onClick={() => onClick(eventInstance)}>
              <span className={'pane-item__options-icon pane-item__options-icon--no-hover'}>
                <Icon id={resolveFlowNodeIconForDebugger(eventInstance.flowNodeType, eventInstance.eventType)} />
              </span>
            </div>
            <div className="pane-item__text">
              {eventInstance.flowNodeId}
              <div className="pane-item__sublabel">{eventInstance.id}</div>
            </div>
            <div className="pane-item__options">
              <Icon id="ph ph-caret-right" />
            </div>
          </div>
        );
      })}
    </PaneBody>
  );
}
