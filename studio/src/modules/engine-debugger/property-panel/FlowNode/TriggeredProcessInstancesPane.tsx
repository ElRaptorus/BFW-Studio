import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { FlowNodeType } from '@elraptorus/daemonengine_sdk';
import type { FlowNodeInstance, ProcessInstance } from '@elraptorus/daemonengine_sdk';

import React, { useEffect, useState } from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayThrowingMessageOrSignalEventPane } from '../ShouldBeDisplayedConditions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayThrowingMessageOrSignalEventPane,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Started Process Instances';
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
    <TriggeredProcessInstancesPane
      editorDocument={props.editorDocument}
      flowNode={flowNode}
      model={props.editorDocumentModel}
      selectedFlowNodeInstance={selectedFlowNodeInstance}
      studio={studio}
    />
  );
}

type TriggeredProcessInstancesPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
  flowNode: FlowNode;
  selectedFlowNodeInstance: FlowNodeInstance;
};

function TriggeredProcessInstancesPane(props: TriggeredProcessInstancesPaneProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [processInstances, setProcessInstances] = useState<ProcessInstance[] | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    async function fetchData(): Promise<void> {
      const triggeredProcessInstances = await props.model.getProcessInstancesTriggeredByFlowNodeInstance(
        props.selectedFlowNodeInstance.id,
      );

      if (mounted) {
        setLoading(false);
        setProcessInstances(triggeredProcessInstances);
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

  if (!processInstances || processInstances.length === 0) {
    if (props.selectedFlowNodeInstance.flowNodeType === FlowNodeType.SendTask) {
      return <PaneBody>No Process Instances were started by this Task.</PaneBody>;
    }
    return <PaneBody>No Process Instances were started by this Event.</PaneBody>;
  }

  const onClick = (processInstanceId: string) => {
    props.studio.commands.executeCommand('engine.debugger.focusOrOpen', [props.model.engineUrl, processInstanceId]);
  };

  return (
    <PaneBody>
      {processInstances.map((processInstance) => {
        return (
          <div
            key={`triggered-process-instance-link_${processInstance.id}`}
            className="pane-item pane-item--hoverable"
            onClick={() => onClick(processInstance.id)}
          >
            <div className="pane-item__squared-rounded-icon" onClick={() => onClick(processInstance.id)}>
              <span className={'pane-item__options-icon pane-item__options-icon--no-hover'}>
                <Icon id="bpmn-icon-participant" />
              </span>
            </div>
            <div className="pane-item__text">
              {processInstance.processModelId ?? processInstance.id}
              <div className="pane-item__sublabel">{processInstance.id}</div>
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
