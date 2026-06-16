import React from 'react';

import type { PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { resolveFlowNodeIconForDebugger } from '../../libs/flowNodeDisplay';
import { shouldDisplayProcessInstanceTriggeredByPane } from '../ShouldBeDisplayedConditions';

type ProcessInstanceTriggeredByPaneProps = PaneComponentProps & {
  editorDocumentModel: EngineBpmnDebuggerEditorDocumentModel;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayProcessInstanceTriggeredByPane,
  Pane: PaneFull,
  PaneContent: ProcessInstanceTriggeredByPane,
};

function getPaneTitle(): string {
  return 'Triggered by Event';
}

function PaneFull(props: ProcessInstanceTriggeredByPaneProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <ProcessInstanceTriggeredByPane {...props} />}
    </Pane>
  );
}

function ProcessInstanceTriggeredByPane(props: ProcessInstanceTriggeredByPaneProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const triggererId = model.processInstance?.triggererFlowNodeInstanceId;
  if (!triggererId) {
    return null;
  }

  const targetFlowNodeInstance = model.flowNodeInstances.find((instance) => instance.id === triggererId);
  if (!targetFlowNodeInstance) {
    return null;
  }

  const onClick = (): void => {
    props.studio.commands.executeCommand('engine.debugger.focusOrOpen', [
      model.engineId,
      targetFlowNodeInstance.processInstanceId,
      targetFlowNodeInstance.id,
    ]);
  };

  return (
    <PaneBody>
      <div className="pane-item pane-item--hoverable" onClick={onClick}>
        <div className="pane-item__squared-rounded-icon" onClick={onClick}>
          <span className={'pane-item__options-icon pane-item__options-icon--no-hover'}>
            <Icon
              id={resolveFlowNodeIconForDebugger(targetFlowNodeInstance.flowNodeType, targetFlowNodeInstance.eventType)}
            />
          </span>
        </div>
        <div className="pane-item__text">
          {targetFlowNodeInstance.flowNodeId}
          <div className="pane-item__sublabel">{targetFlowNodeInstance.id}</div>
        </div>
        <div className="pane-item__options">
          <Icon id="ph ph-caret-right" />
        </div>
      </div>
    </PaneBody>
  );
}
