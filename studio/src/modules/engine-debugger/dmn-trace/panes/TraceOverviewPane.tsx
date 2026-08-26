import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type { DmnTraceFragmentData } from '../DmnTraceTypes';
import { getSelectionFromDocument, getTraceDataFromDocument, isDmnTraceDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: TraceOverviewPane,
};

function getPaneTitle(): string {
  return 'Trace Overview';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isDmnTraceDocument(editorDocument)) {
    return false;
  }
  return getSelectionFromDocument(editorDocumentModel) == null;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <TraceOverviewPane {...props} />}
    </Pane>
  );
}

function TraceOverviewPane(props: PaneComponentProps): React.JSX.Element | null {
  const data = props.editorDocument?.data?.current as DmnTraceFragmentData | null;
  const traceProperties = getTraceDataFromDocument(props.editorDocumentModel);
  const flowNodeInstance = data?.flowNodeInstance;

  if (!traceProperties) {
    return null;
  }

  const durationMs = (traceProperties.duration_us / 1000).toFixed(1);

  return (
    <PaneBody>
      <PaneProperty type="text" label="Decision Ref" disabled={true} value={traceProperties.decision_ref} />
      {traceProperties.decision_element_id && (
        <PaneProperty
          type="text"
          label="Decision Element"
          disabled={true}
          value={traceProperties.decision_element_id}
        />
      )}
      <PaneProperty type="text" label="Version" disabled={true} value={traceProperties.version} />
      <PaneProperty type="text" label="Hit Policy" disabled={true} value={traceProperties.hit_policy} />
      <PaneProperty type="text" label="Duration" disabled={true} value={`${durationMs} ms`} />
      <PaneProperty
        type="text"
        label="Decisions Evaluated"
        disabled={true}
        value={String(traceProperties.trace.decisions.length)}
      />
      <PaneProperty
        type="text"
        label="Rules Matched"
        disabled={true}
        value={traceProperties.matched_rules.join(', ') || 'None'}
      />
      {flowNodeInstance && (
        <>
          <PaneProperty type="text" label="Flow Node" disabled={true} value={flowNodeInstance.flowNodeId} />
          <PaneProperty type="text" label="FNI State" disabled={true} value={flowNodeInstance.state} />
          {flowNodeInstance.startedAt && (
            <PaneProperty type="text" label="Started At" disabled={true} value={flowNodeInstance.startedAt} />
          )}
          {flowNodeInstance.finishedAt && (
            <PaneProperty type="text" label="Finished At" disabled={true} value={flowNodeInstance.finishedAt} />
          )}
        </>
      )}
      {traceProperties.trace.input_coercions.length > 0 && (
        <PaneProperty
          type="text"
          label="Input Coercions"
          disabled={true}
          value={`${traceProperties.trace.input_coercions.filter((coercion) => coercion.coerced).length} of ${traceProperties.trace.input_coercions.length} inputs coerced`}
        />
      )}
    </PaneBody>
  );
}
