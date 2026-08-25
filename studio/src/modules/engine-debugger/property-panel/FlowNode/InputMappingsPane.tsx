import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getInputMappings } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayInputMappingsPane } from '../ShouldBeDisplayedConditions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed: shouldDisplayInputMappingsPane,
  Pane: PaneFull,
  PaneContent: InputMappingsPane,
};

function getPaneTitle(): string {
  return 'Input Mappings';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <InputMappingsPane {...props} />}
    </Pane>
  );
}

function InputMappingsPane(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;

  const mappings = getInputMappings(flowNodeModel);

  if (mappings.length === 0) {
    return (
      <PaneBody>
        <PaneProperty type="text" label="Input Mappings" value="—" disabled />
      </PaneBody>
    );
  }

  return (
    <PaneBody>
      {mappings.map((mapping) => (
        <PaneProperty
          key={`${mapping.source}->${mapping.target}`}
          type="text"
          label={mapping.target || '?'}
          value={mapping.source}
          disabled
        />
      ))}
    </PaneBody>
  );
}
