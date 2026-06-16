import { getHumanizedDateTime, getHumanizedDuration } from '#modules/engine-core/Formatters';

import React from 'react';

import type { PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { shouldDisplayProcessInstanceInfoPane } from '../ShouldBeDisplayedConditions';

type ProcessInstanceRuntimePaneProps = PaneComponentProps & {
  editorDocumentModel: EngineBpmnDebuggerEditorDocumentModel;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayProcessInstanceInfoPane,
  Pane: PaneFull,
  PaneContent: ProcessInstanceRuntimePane,
};

function getPaneTitle(): string {
  return 'Runtime';
}

function PaneFull(props: ProcessInstanceRuntimePaneProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <ProcessInstanceRuntimePane {...props} />}
    </Pane>
  );
}

function ProcessInstanceRuntimePane(props: ProcessInstanceRuntimePaneProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const processInstance = model.processInstance;
  if (!processInstance) {
    return null;
  }

  const durationMilliseconds =
    processInstance.finishedAt != null
      ? new Date(processInstance.finishedAt).getTime() - new Date(processInstance.startedAt).getTime()
      : null;

  return (
    <PaneBody>
      <PaneProperty
        type="text"
        label="Started At"
        disabled={true}
        value={getHumanizedDateTime(processInstance.startedAt)}
      />
      {processInstance.finishedAt != null ? (
        <PaneProperty
          type="text"
          label="Finished At"
          disabled={true}
          value={getHumanizedDateTime(processInstance.finishedAt)}
        />
      ) : null}
      {durationMilliseconds != null ? (
        <PaneProperty
          type="text"
          label="Total Duration"
          disabled={true}
          value={getHumanizedDuration(durationMilliseconds)}
        />
      ) : null}
    </PaneBody>
  );
}
