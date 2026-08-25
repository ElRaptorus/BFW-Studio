import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider, Studio } from '@evil/bifrost_fw_sdk';
import { BpmnElementType, Icon, Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';
import type { BpmnElement_Participant } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

import type BpmnDocumentModel from '../../BpmnDocumentModel';

const PROCESSES_HELP_ID = 'bpmn/properties/process';

type ProcessPaneItemProps = {
  bifrost: Studio;
  bpmnDocumentModel: BpmnDocumentModel;
  participant: BpmnElement_Participant;
  index: number;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Processes';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost = props.studio;

  return (
    <Pane>
      <PaneHeader studio={bifrost} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={bifrost} id={PROCESSES_HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument == null || editorDocument.modelKey !== 'BpmnDocumentModel' || editorDocumentModel == null) {
    return false;
  }

  const bpmnDocumentModel: BpmnDocumentModel = editorDocumentModel;

  if (bpmnDocumentModel.elements.isInsideSubprocessPlane()) {
    return false;
  }

  const selection = bpmnDocumentModel.selection.getElements();
  if (selection.length === 0) {
    const allParticipants = bpmnDocumentModel.elements.getByType<BpmnElement_Participant>(BpmnElementType.Participant);

    if (allParticipants.length === 0) {
      return false;
    }

    return true;
  }

  return false;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const editorDocument: EditorDocument = props.editorDocument;
  const bpmnDocumentModel: BpmnDocumentModel | null = props.editorDocumentModel;

  if (editorDocument == null || editorDocument.modelKey !== 'BpmnDocumentModel' || bpmnDocumentModel == null) {
    return null;
  }

  const allParticipants = bpmnDocumentModel.elements.getByType<BpmnElement_Participant>(BpmnElementType.Participant);

  return (
    <PaneBody>
      {allParticipants.map((participant, index) => {
        return (
          <ProcessPaneItem
            key={participant.id}
            bifrost={props.studio}
            bpmnDocumentModel={bpmnDocumentModel}
            participant={participant}
            index={index}
          />
        );
      })}
    </PaneBody>
  );
}

function ProcessPaneItem(props: ProcessPaneItemProps): React.JSX.Element {
  const onClick = (): void => {
    props.bpmnDocumentModel.selection.selectElement(props.participant.id);
    props.bpmnDocumentModel.zoomToElement(props.participant.id);
  };

  return (
    <div
      className="pane-item pane-item--hoverable"
      data-bs-title="Select Process"
      data-bs-toggle="tooltip"
      onClick={onClick}
      data-test--process-pane-item={props.index}
    >
      <div className="pane-item__squared-rounded-icon">
        <span className={`pane-item__options-icon pane-item__options-icon--no-hover`}>
          <Icon id="bpmn/participant" />
        </span>
      </div>
      <div className="pane-item__text pane-item__text--no-overflow">
        {props.participant?.process?.name || props.participant?.name || <em>Untitled Process</em>}
        <div className="pane-item__sublabel">{props.participant?.process?.id}</div>
      </div>
      <div className="pane-item__options">
        <Icon id="ph ph-caret-right" />
      </div>
    </div>
  );
}
