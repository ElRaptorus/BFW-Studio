import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import {
  type MappingEntry,
  getExtensionMappings,
  getSelection,
  isModelViewerDocument,
  matchesType,
} from './paneHelpers';

const OUTBOUND_PIPELINE_TYPES = [
  ':UserTask',
  ':ServiceTask',
  ':ScriptTask',
  ':BusinessRuleTask',
  ':CallActivity',
  ':ReceiveTask',
  ':IntermediateCatchEvent',
  ':BoundaryEvent',
  ':StartEvent',
];

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Output Mappings';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  const selection = getSelection(editorDocumentModel);
  return selection != null && matchesType(selection, OUTBOUND_PIPELINE_TYPES);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getSelection(props.editorDocumentModel);
  if (!selection) {
    return null;
  }

  const mappings: MappingEntry[] = getExtensionMappings(selection.businessObject, ':outputMapping');

  if (mappings.length === 0) {
    return (
      <div className="engine-pane-process-info">
        <PaneProperty type="text" label="Output Mappings" value="—" disabled />
      </div>
    );
  }

  return (
    <div className="engine-pane-process-info">
      {mappings.map((mapping, index) => (
        <PaneProperty
          key={`output-${index}`}
          type="text"
          label={mapping.target || '?'}
          value={mapping.source}
          disabled
        />
      ))}
    </div>
  );
}
