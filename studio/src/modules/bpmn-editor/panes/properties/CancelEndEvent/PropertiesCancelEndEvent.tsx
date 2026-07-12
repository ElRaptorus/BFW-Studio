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
  return 'Cancel End Event';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id="bpmn/properties/cancel_end_event" />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  return shouldBeDisplayedForBpmnElementOfType(editorDocument, editorDocumentModel, BpmnElementType.CancelEndEvent);
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);

  if (selection == null) {
    return null;
  } else {
    return <PropertiesCancelEndEvent key={getKeyForPropertiesPane(selection)} {...props} />;
  }
}

function PropertiesCancelEndEvent(_props: PaneComponentProps): React.JSX.Element {
  return (
    <PaneBody>
      <p className="text-muted small">
        A <strong>Cancel End Event</strong> is only valid inside a <code>bpmn:transaction</code> subprocess. When it
        fires, the Engine cancels all active activities within the transaction scope and triggers LIFO compensation for
        all completed activities that have a compensation boundary event and handler. The transaction subprocess ends in
        the <code>cancelled</code> state.
      </p>
      <p className="text-muted small">
        If the outer process has a <strong>Cancel Boundary Event</strong> attached to the transaction subprocess, it
        fires after the cancel completes; otherwise the transaction subprocess fails as a hazard.
      </p>
    </PaneBody>
  );
}
