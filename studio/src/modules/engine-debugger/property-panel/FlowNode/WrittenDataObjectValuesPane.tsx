import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';

import React from 'react';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import type { FlowNode } from '../../libs/index';
import { DataObjectInstanceLink } from '../FlowNodeInstanceLinks';
import { shouldDisplayWritenDataObjectValuesPane } from '../ShouldBeDisplayedConditions';

type WrittenDataObjectValuesPaneProps = {
  editorDocument: EditorDocument;
  model: EngineBpmnDebuggerEditorDocumentModel;
  studio: Bifrost;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayWritenDataObjectValuesPane,
  Pane: PaneFull,
  PaneContent: WrittenDataObjectValuesPane,
};

function getPaneTitle(): string {
  return 'Written Data Object Values';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/data_object" />
      </PaneHeader>
      {props.collapsed !== true && <WrittenDataObjectValuesPane {...props} model={props.editorDocumentModel} />}
    </Pane>
  );
}

function WrittenDataObjectValuesPane(props: WrittenDataObjectValuesPaneProps): React.JSX.Element | null {
  const flowNode = props.model.selectedElements[0] as FlowNode;

  const selectedFlowNodeInstance = props.model.getSelectedFlowNodeInstanceByFlowNode(flowNode);

  const writtenDataObjectValues = props.model.dataObjectValues.filter(
    (dataObjectInstance) => dataObjectInstance.flowNodeInstanceId === selectedFlowNodeInstance.id,
  );

  return (
    <PaneBody>
      {writtenDataObjectValues.map((dataObjectInstance) => {
        const dataObjectModel = props.model.processModel?.dataObjectReferences.find(
          (dataObject) => dataObject.id === dataObjectInstance.dataObjectId,
        );

        return (
          <DataObjectInstanceLink
            key={`${dataObjectInstance.dataObjectId}_${selectedFlowNodeInstance.id}`}
            iconComponent={Icon}
            model={props.model}
            targetDataObjectName={dataObjectModel?.name}
            targetDataObjectId={dataObjectInstance.dataObjectId}
            targetDataObjectInstanceId={dataObjectInstance.id}
            sublabel={selectedFlowNodeInstance.id}
          />
        );
      })}
    </PaneBody>
  );
}
