import React from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneBody, PaneHeader } from '@evil/bifrost_fw_sdk';

import { resolveAttributeLabel } from '../../dmn-core/diff';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function shouldBeDisplayed(editorDocument: EditorDocument): boolean {
  if (editorDocument == null) {
    return false;
  }
  if (
    editorDocument.modelKey !== 'DmnDiffDocumentModel' &&
    editorDocument.modelKey !== 'DmnHistoryPreviewDocumentModel'
  ) {
    return false;
  }
  return editorDocument.metadata.selectedElementIds?.length > 0;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function getPaneTitle(): string {
  return 'What has changed?';
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  if (props.editorDocumentModel == null) {
    return null;
  }

  const selection = props.editorDocument.metadata.selectedElementIds;
  const changes = selection == null ? null : props.editorDocumentModel.getChangesById(selection[0]);

  if (changes == null || changes.length === 0) {
    return <PaneBody>No changes.</PaneBody>;
  }

  const addChange = changes.find((change: any) => change.action === 'added');
  const deleteChange = changes.find((change: any) => change.action === 'removed');
  const moveChange = changes.find((change: any) => change.action === 'layoutChanged');
  const updateChange = changes.find((change: any) => change.action === 'updated');

  const updatedAttributes = updateChange?.change?.attrs;

  return (
    <PaneBody>
      {addChange && (
        <p>
          <span className="bpmn-diff-legend bpmn-diff-legend--added">
            <Icon id="dmn-diff/element/added" />
          </span>{' '}
          This element has been added.
        </p>
      )}
      {deleteChange && (
        <p>
          <span className="bpmn-diff-legend bpmn-diff-legend--deleted">
            <Icon id="dmn-diff/element/deleted" />
          </span>{' '}
          This element has been deleted.
        </p>
      )}
      {moveChange && (
        <p>
          <span className="bpmn-diff-legend bpmn-diff-legend--moved">
            <Icon id="dmn-diff/element/moved" />
          </span>{' '}
          This element&apos;s layout has changed.
        </p>
      )}
      {updateChange && (
        <p>
          <span className="bpmn-diff-legend bpmn-diff-legend--updated">
            <Icon id="dmn-diff/element/updated" />
          </span>{' '}
          This element has changed its attributes.
        </p>
      )}

      {updatedAttributes &&
        Object.keys(updatedAttributes).map((attributeName) => {
          const values = updatedAttributes[attributeName];
          return (
            <div key={attributeName} className="form-group">
              <label>{resolveAttributeLabel(attributeName)}</label>
              <span className="stubbed-form-control">
                <pre className="diff-value diff-value--removed">{formatDiffValue(values.oldValue)}</pre>
                <pre className="diff-value diff-value--added">{formatDiffValue(values.newValue)}</pre>
              </span>
            </div>
          );
        })}
    </PaneBody>
  );
}

function formatDiffValue(value: any): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
