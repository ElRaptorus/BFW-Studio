import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneHeader, PaneProperty } from '@evil/bifrost_fw_sdk';

import { getSelection, isModelViewerDocument, matchesType, readFlowNodeString } from './paneHelpers';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function getPaneTitle(): string {
  return 'Service Task';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isModelViewerDocument(editorDocument)) {
    return false;
  }
  return matchesType(getSelection(editorDocumentModel), [':ServiceTask']);
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
  const implementation =
    readFlowNodeString(props.editorDocumentModel, (flowNode) =>
      flowNode.typeData.type === 'service_task' ? flowNode.typeData.implementation : undefined,
    ) ?? '—';
  const isHttp = implementation === 'http';

  const httpUrl = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'service_task' ? flowNode.typeData.httpUrl : undefined,
  );
  const httpMethod = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'service_task' ? flowNode.typeData.httpMethod : undefined,
  );
  const httpBody = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'service_task' ? flowNode.typeData.httpBody : undefined,
  );
  const httpAuthHeader = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'service_task' ? flowNode.typeData.httpAuthHeader : undefined,
  );
  const httpResponseHeaders = readFlowNodeString(props.editorDocumentModel, (flowNode) =>
    flowNode.typeData.type === 'service_task' ? flowNode.typeData.httpResponseHeaders : undefined,
  );

  return (
    <div className="engine-pane-process-info">
      <PaneProperty type="text" label="Implementation" value={implementation} disabled />
      {isHttp && httpUrl != null && <PaneProperty type="text" label="URL" value={httpUrl} disabled />}
      {isHttp && httpMethod != null && <PaneProperty type="text" label="Method" value={httpMethod} disabled />}
      {isHttp && httpAuthHeader != null && (
        <PaneProperty type="text" label="Auth Header" value={httpAuthHeader} disabled />
      )}
      {isHttp && httpBody != null && <PaneProperty type="textarea" label="Body" value={httpBody} disabled rows={4} />}
      {isHttp && httpResponseHeaders != null && (
        <PaneProperty type="text" label="Response Headers" value={httpResponseHeaders} disabled />
      )}
    </div>
  );
}
