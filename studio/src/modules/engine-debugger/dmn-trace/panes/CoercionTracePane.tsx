import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import './DmnTracePanes.scss';
import { getSelectionFromDocument, getTraceDataFromDocument, isDmnTraceDocument } from './paneUtils';

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: CoercionTracePane,
};

function getPaneTitle(): string {
  return 'Input Coercions';
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
      {props.collapsed !== true && <CoercionTracePane {...props} />}
    </Pane>
  );
}

function CoercionTracePane(props: PaneComponentProps): React.JSX.Element | null {
  const traceData = getTraceDataFromDocument(props.editorDocumentModel);
  if (!traceData || traceData.trace.input_coercions.length === 0) {
    return (
      <PaneBody>
        <div className="dmn-trace-pane-section__empty">No input coercions recorded.</div>
      </PaneBody>
    );
  }

  return (
    <PaneBody>
      <table className="dmn-trace-pane-section__table">
        <thead>
          <tr>
            <th>Input</th>
            <th>Target Type</th>
            <th>Original</th>
            <th>Coerced</th>
            <th>Changed</th>
          </tr>
        </thead>
        <tbody>
          {traceData.trace.input_coercions.map((coercion) => (
            <tr key={coercion.input_name} className={coercion.coerced ? 'dmn-trace-pane-section__row--coerced' : ''}>
              <td>{coercion.input_name}</td>
              <td>{coercion.target_type}</td>
              <td className="dmn-trace-pane-section__monospace">{formatValue(coercion.original_value)}</td>
              <td className="dmn-trace-pane-section__monospace">{formatValue(coercion.coerced_value)}</td>
              <td>{coercion.coerced ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PaneBody>
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
