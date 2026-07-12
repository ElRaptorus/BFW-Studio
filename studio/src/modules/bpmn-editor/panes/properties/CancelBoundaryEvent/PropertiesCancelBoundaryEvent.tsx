import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { BpmnElementType, Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';

import {
  getBpmnSelectionForPropertiesPane,
  getKeyForPropertiesPane,
  shouldBeDisplayedForBpmnElementOfType,
} from '../../PropertiesPaneFunctions';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Cancel Boundary Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/cancel_boundary_event" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(
    editorDocument,
    editorDocumentModel,
    BpmnElementType.CancelBoundaryEvent,
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);

  if (selection == null) {
    return null;
  } else {
    return <PropertiesCancelBoundaryEvent key={getKeyForPropertiesPane(selection)} {...props} />;
  }
}

function PropertiesCancelBoundaryEvent(_props: PaneComponentProps): React.JSX.Element {
  return (
    <PaneBody>
      <p className="text-muted small">
        A <strong>Cancel Boundary Event</strong> must be attached to a <code>bpmn:transaction</code> subprocess. It
        fires reactively after the Engine processes a Cancel End Event inside the transaction and completes all
        compensation runs. Cancel Boundary Events are always interrupting.
      </p>
      <p className="text-muted small">
        At most one Cancel Boundary Event may be attached to a transaction subprocess. If a Cancel End Event fires
        inside a transaction that has no Cancel Boundary Event, the transaction subprocess ends as a hazard (fatal).
      </p>
    </PaneBody>
  );
}
