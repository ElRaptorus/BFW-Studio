import type { FlowNode as BpmnFlowNode } from '@elraptorus/daemonengine_sdk';

import React from 'react';

import type { PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getOutputMappings } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/SelectableElement';
import { shouldDisplayOutputMappingsPane } from '../ShouldBeDisplayedConditions';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed: shouldDisplayOutputMappingsPane,
  Pane: PaneFull,
  PaneContent: OutputMappingsPane,
};

function getPaneTitle(): string {
  return 'Output Mappings';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <OutputMappingsPane {...props} />}
    </Pane>
  );
}

function OutputMappingsPane(props: PaneComponentProps): React.JSX.Element {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;
  const flowNodeModel = flowNode.flowNodeModel as BpmnFlowNode | undefined;

  const mappings = getOutputMappings(flowNodeModel);

  if (mappings.length === 0) {
    return (
      <PaneBody>
        <PaneProperty type="text" label="Output Mappings" value="—" disabled />
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
