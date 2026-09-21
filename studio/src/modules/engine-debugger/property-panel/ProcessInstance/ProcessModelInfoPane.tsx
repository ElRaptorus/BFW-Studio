import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { JumpToSymbolInSolutionLink } from '../JumpToSymbolInSolutionLink';
import { shouldDisplayProcessModelInfoPane } from '../ShouldBeDisplayedConditions';

type ProcessModelInfoPaneProps = PaneComponentProps & {
  editorDocumentModel: EngineBpmnDebuggerEditorDocumentModel;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayProcessModelInfoPane,
  Pane: PaneFull,
  PaneContent: ProcessModelInfoPane,
};

function getPaneTitle(): string {
  return 'Process Model';
}

function PaneFull(props: ProcessModelInfoPaneProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={'bpmn/properties/process'} />
      </PaneHeader>
      {props.collapsed !== true && <ProcessModelInfoPane {...props} />}
    </Pane>
  );
}

function ProcessModelInfoPane(props: ProcessModelInfoPaneProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  if (!model.processInstance) {
    return null;
  }

  const selectedElements = model.selectedElements;
  const selectedParticipant =
    selectedElements.length === 1 && selectedElements[0].type === 'Participant' ? selectedElements[0] : undefined;

  const processModelId = selectedParticipant?.processModelId ?? model.processInstance.processModelId ?? '';

  return (
    <PaneBody>
      {model.processModel?.name && (
        <PaneProperty type="text" label="Model Name" disabled={true} value={model.processModel.name} />
      )}
      <PaneProperty
        type="text"
        label={
          <>
            Model ID{' '}
            <JumpToSymbolInSolutionLink
              studio={props.studio}
              definitionId={processModelId}
              elementId={processModelId}
            />
          </>
        }
        disabled={true}
        value={processModelId}
      />
      <PaneProperty
        type="text"
        label="Version"
        disabled={true}
        value={model.processInstance?.version ?? model.processModel?.version ?? ''}
      />
      {model.processModel?.correlationKey && (
        <PaneProperty type="text" label="Correlation Key" disabled={true} value={model.processModel.correlationKey} />
      )}
    </PaneBody>
  );
}
