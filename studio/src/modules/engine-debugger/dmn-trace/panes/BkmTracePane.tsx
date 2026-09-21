import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type { SnakeCaseBkmTrace } from '../DmnTraceTypes';
import './DmnTracePanes.scss';
import { getSelectionFromDocument, getTraceDataFromDocument, isDmnTraceDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: BkmTracePane,
};

function getPaneTitle(): string {
  return 'BKM Traces';
}

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: EditorDocumentModel): boolean {
  if (!isDmnTraceDocument(editorDocument)) {
    return false;
  }
  return getSelectionFromDocument(editorDocumentModel)?.type === 'decision';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <BkmTracePane {...props} />}
    </Pane>
  );
}

function BkmTracePane(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getSelectionFromDocument(props.editorDocumentModel);
  const traceData = getTraceDataFromDocument(props.editorDocumentModel);
  if (!selection || !traceData) {
    return null;
  }

  const decisionTrace = traceData.trace.decisions.find(
    (decision) => decision.decision_model_id === selection.elementId,
  );

  if (!decisionTrace || decisionTrace.bkm_traces.length === 0) {
    return (
      <PaneBody>
        <div className="dmn-trace-pane-section__empty">No BKM invocations for this decision.</div>
      </PaneBody>
    );
  }

  return (
    <PaneBody>
      {decisionTrace.bkm_traces.map((bkmTrace) => (
        <BkmTraceEntry key={bkmTraceKey(bkmTrace)} bkmTrace={bkmTrace} depth={0} />
      ))}
    </PaneBody>
  );
}

function BkmTraceEntry(props: { bkmTrace: SnakeCaseBkmTrace; depth: number }): React.JSX.Element {
  const { bkmTrace, depth } = props;
  const durationMs = (bkmTrace.duration_microseconds / 1000).toFixed(1);
  const indent = depth > 0 ? { paddingLeft: `${depth * 12}px` } : undefined;

  return (
    <div style={indent}>
      <PaneProperty type="text" label="BKM" disabled={true} value={bkmTrace.bkm_name ?? bkmTrace.bkm_id} />
      <PaneProperty type="text" label="Duration" disabled={true} value={`${durationMs} ms`} />
      {bkmTrace.formal_parameters.length > 0 && (
        <div className="dmn-trace-pane-section">
          <div className="dmn-trace-pane-section__title">Parameters</div>
          <table className="dmn-trace-pane-section__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Bound Value</th>
              </tr>
            </thead>
            <tbody>
              {bkmTrace.formal_parameters.map((param) => (
                <tr key={param.name}>
                  <td>{param.name}</td>
                  <td className="dmn-trace-pane-section__monospace">{formatValue(param.bound_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaneProperty type="text" label="Result" disabled={true} value={formatValue(bkmTrace.result)} />
      {bkmTrace.dependent_bkm_traces.map((dependentTrace) => (
        <BkmTraceEntry key={bkmTraceKey(dependentTrace)} bkmTrace={dependentTrace} depth={depth + 1} />
      ))}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value == null) {
    return '—';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function bkmTraceKey(bkmTrace: SnakeCaseBkmTrace): string {
  return `${bkmTrace.bkm_id}:${formatValue(bkmTrace.result)}:${bkmTrace.duration_microseconds}`;
}
