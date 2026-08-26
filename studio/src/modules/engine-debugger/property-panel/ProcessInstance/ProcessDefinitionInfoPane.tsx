import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { shouldDisplayProcessModelInfoPane } from '../ShouldBeDisplayedConditions';

type ProcessDefinitionInfoPaneProps = PaneComponentProps & {
  editorDocumentModel: EngineBpmnDebuggerEditorDocumentModel;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayProcessModelInfoPane,
  Pane: PaneFull,
  PaneContent: ProcessDefinitionInfoPane,
};

function getPaneTitle(): string {
  return 'Process Definition';
}

function PaneFull(props: ProcessDefinitionInfoPaneProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={'bpmn/properties/process'} />
      </PaneHeader>
      {props.collapsed !== true && <ProcessDefinitionInfoPane {...props} />}
    </Pane>
  );
}

function ProcessDefinitionInfoPane(props: ProcessDefinitionInfoPaneProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  if (!model.processInstance) {
    return null;
  }

  return (
    <PaneBody>
      <PaneProperty
        type="text"
        label="Definition ID"
        disabled={true}
        value={model.processInstance.processModelId ?? ''}
      />
      <PaneProperty
        type="text"
        label="Version"
        disabled={true}
        value={model.processInstance.version ?? model.processModel?.version ?? ''}
      />
      <PaneProperty
        type="text"
        label="Definitions ID"
        disabled={true}
        value={model.processDefinition?.definitionsId ?? ''}
      />
    </PaneBody>
  );
}
