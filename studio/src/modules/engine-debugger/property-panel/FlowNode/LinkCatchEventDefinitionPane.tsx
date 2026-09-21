import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import type { FlowNode as BpmnFlowNode } from '@elraptorus/bfw_engine_sdk';
import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { getLinkName } from '../../libs/BpmnFlowNodeAccessors';
import type { FlowNode } from '../../libs/index';
import { shouldDisplayLinkCatchEventInstancePane } from '../ShouldBeDisplayedConditions';

type LinkCatchEventDefinitionPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
  flowNode: FlowNode;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayLinkCatchEventInstancePane,
  Pane: PaneFull,
  PaneContent: LinkCatchEventDefinitionPane,
};

function getPaneTitle(): string {
  return 'Intermediate Link Catch Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const studio = props.studio;
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  const flowNode = model.selectedElements[0] as FlowNode;

  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={studio} id="bpmn/properties/link_intermediate-catch_event" />
      </PaneHeader>
      {props.collapsed !== true && (
        <LinkCatchEventDefinitionPane
          editorDocument={props.editorDocument}
          flowNode={flowNode}
          model={props.editorDocumentModel}
          studio={studio}
        />
      )}
    </Pane>
  );
}

function LinkCatchEventDefinitionPane(props: LinkCatchEventDefinitionPaneProps): React.JSX.Element {
  const linkEvent = props.flowNode.flowNodeModel as BpmnFlowNode | undefined;

  return (
    <PaneBody>
      <PaneProperty type="text" label="Link Name" disabled={true} value={getLinkName(linkEvent)} />
    </PaneBody>
  );
}
