import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Icon } from '#components/Icon';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { ATTRIBUTE_LABELS } from '../../bpmn-core/diff';
import type { AttributeChange, CustomPropertyDelta } from '../../bpmn-core/diff';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function shouldBeDisplayed(editorDocument: EditorDocument, editorDocumentModel: any): boolean {
  if (editorDocument == null || editorDocumentModel == null) {
    return false;
  }
  if (
    editorDocument.modelKey !== 'BpmnDiffDocumentModel' &&
    editorDocument.modelKey !== 'BpmnHistoryPreviewDocumentModel'
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

export function getPaneTitle(): string {
  return 'What has changed?';
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  if (props.editorDocumentModel == null) {
    return null;
  }

  const selection = props.editorDocument.metadata.selectedElementIds;
  const changes = selection == null ? null : props.editorDocumentModel.getChangesById(selection[0]);

  if (changes == null) {
    return <PaneBody>No changes.</PaneBody>;
  }

  const addChange = changes.find((change) => change.action === 'added');
  const deleteChange = changes.find((change) => change.action === 'deleted');
  const moveChange = changes.find((change) => change.action === 'moved');
  const updateChange = changes.find((change) => change.action === 'updated');

  const updatedAttributes = updateChange?.change.attrs;
  const updatedModel = updateChange?.change.model;
  const selectedElementId = selection?.[0];
  const customPropChanges =
    selectedElementId != null
      ? (props.editorDocumentModel.getCustomPropertiesForElement?.(selectedElementId) ?? [])
      : [];
  const callActivityExtensionChanges: AttributeChange[] =
    selectedElementId != null
      ? (props.editorDocumentModel.getCallActivityExtensionChangesForElement?.(selectedElementId) ?? [])
      : [];
  const hideRawExtensionElements = customPropChanges.length > 0 || callActivityExtensionChanges.length > 0;

  return (
    <PaneBody>
      {addChange && (
        <p>
          <span className="bpmn-diff-legend bpmn-diff-legend--added">
            <Icon id="bpmn-diff/element/added" />
          </span>{' '}
          This element has been added.
        </p>
      )}
      {deleteChange && (
        <p>
          <span className="bpmn-diff-legend bpmn-diff-legend--deleted">
            <Icon id="bpmn-diff/element/deleted" />
          </span>{' '}
          This element has been deleted.
        </p>
      )}
      {moveChange && (
        <p>
          <span className="bpmn-diff-legend bpmn-diff-legend--moved">
            <Icon id="bpmn-diff/element/moved" />
          </span>{' '}
          This element&apos;s layout and/or appearance have changed.
        </p>
      )}
      {updateChange && (
        <p>
          <span className="bpmn-diff-legend bpmn-diff-legend--updated">
            <Icon id="bpmn-diff/element/updated" />
          </span>{' '}
          This element has changed its attributes.
        </p>
      )}

      {updatedAttributes &&
        Object.keys(updatedAttributes)
          .filter((attributeName) => {
            if (attributeName !== 'extensionElements') {
              return true;
            }
            return !hideRawExtensionElements;
          })
          .map((attributeName) => {
            const label = ATTRIBUTE_LABELS[attributeName] || captializeAttributeName(attributeName);
            const values = updatedAttributes[attributeName];

            let beforeValue = values.oldValue;
            let afterValue = values.newValue;

            if (attributeName === 'documentation[0]') {
              beforeValue = values.oldValue?.text;
              afterValue = updatedModel?.documentation[0]?.text;
            }

            if (attributeName === 'eventDefinitions[0]') {
              beforeValue = values.oldValue ? JSON.stringify(values.oldValue, null, 2) : undefined;
              afterValue = updatedModel?.eventDefinitions[0]
                ? JSON.stringify(updatedModel?.eventDefinitions[0], null, 2)
                : undefined;
            }

            if (attributeName === 'extensionElements') {
              beforeValue = values.oldValue ? JSON.stringify(values.oldValue, null, 2) : undefined;
              afterValue = values.newValue ? JSON.stringify(values.newValue, null, 2) : undefined;
            }
            return (
              <UpdatedAttribute
                key={`${selection}_${attributeName}`}
                label={label}
                beforeValue={beforeValue}
                afterValue={afterValue}
              />
            );
          })}

      {callActivityExtensionChanges.map((change) => (
        <UpdatedAttribute
          key={`${selectedElementId}_ca_${change.attribute}`}
          label={change.attribute}
          beforeValue={change.oldValue}
          afterValue={change.newValue}
        />
      ))}

      {customPropChanges.length > 0 && (
        <div className="form-group">
          <label>Custom Properties</label>
          {customPropChanges.map((ch) => (
            <CustomPropertyDiffRow key={`${selectedElementId}_cp_${ch.propertyName}-${ch.kind}`} delta={ch} />
          ))}
        </div>
      )}

      {/* <form>
        <div className="form-group">
          <label>ID</label>
          <span className="stubbed-form-control">
            Task_<span className="diff-value--removed">1</span>
            <span className="diff-value--added">OrderAPizza</span>
          </span>
        </div>
        <div className="form-group">
          <label>Name</label>
          <span className="stubbed-form-control">Order a Pizza</span>
        </div>
        <div className="form-group">
          <label>Handler</label>
          <span className="stubbed-form-control">
            <span className="diff-value--removed">Service Task</span>
            <span className="diff-value--added">Untyped Task</span>
          </span>
        </div>
        <div className="form-group">
          <label>Script</label>
          <small>
            &nbsp;
            <a href="#">Open in Tab</a>
          </small>

          <div className="stubbed-form-control stubbed-form-control--textarea">
            <table className="diff-info diff-info--in-textarea">
              <tbody>
                <tr>
                  <th className="diff-info__line-no diff-info__line-no--expand-icon">
                    <Icon id="ph ph-arrows-out-line-vertical" />
                  </th>
                  <td className="diff-info__value" />
                </tr>
                <tr>
                  <th className="diff-info__line-no">7</th>
                  <td className="diff-info__value diff-info__value--changed">
                    console.log('followed link<span className="diff-info__value--removed">1</span>');
                  </td>
                </tr>
                <tr>
                  <th className="diff-info__line-no diff-info__line-no--expand-icon">
                    <Icon id="ph ph-arrows-out-line-vertical" />
                  </th>
                  <td className="diff-info__value" />
                </tr>
                <tr>
                  <th className="diff-info__line-no">14</th>
                  <td className="diff-info__value diff-info__element--added">
                    <span className="diff-info__value--added">// TODO: see if we can improve this</span>
                  </td>
                </tr>
                <tr>
                  <th className="diff-info__line-no">16</th>
                  <td className="diff-info__value diff-info__element--removed">
                    return 'followed link <span className="diff-info__value--removed">1</span>';
                  </td>
                </tr>
                <tr>
                  <th className="diff-info__line-no">16</th>
                  <td className="diff-info__value diff-info__element--added">
                    return 'followed link <span className="diff-info__value--removed">1</span>
                    <span className="diff-info__value--added">2</span>';
                  </td>
                </tr>
                <tr>
                  <th className="diff-info__line-no">17</th>
                  <td className="diff-info__value diff-info__element--added">
                    <span className="diff-info__value--added">}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </form> */}
    </PaneBody>
  );
}

function UpdatedAttribute(props: any): React.JSX.Element {
  const isMultilineProperty =
    props.beforeValue?.toString().includes('\n') || props.afterValue?.toString().includes('\n');

  return (
    <div className="form-group">
      <label>{props.label}</label>
      <span className={`stubbed-form-control ${isMultilineProperty ? 'stubbed-form-control--textarea' : ''}`}>
        <pre className="diff-value diff-value--removed">{props.beforeValue?.toString()}</pre>
        <pre className="diff-value diff-value--added">{props.afterValue?.toString()}</pre>
      </span>
    </div>
  );
}

function displayCustomPropValue(value: string | undefined): string {
  if (value == null || value === '') {
    return '';
  }
  return value;
}

function CustomPropertyDiffRow(props: { delta: CustomPropertyDelta }): React.JSX.Element {
  const { delta: ch } = props;
  const beforeText = displayCustomPropValue(ch.oldValue);
  const afterText = displayCustomPropValue(ch.newValue);
  const isMultiline = beforeText.includes('\n') || afterText.includes('\n');

  let kindHint = ' — value changed';
  if (ch.kind === 'added') {
    kindHint = ' — property added';
  } else if (ch.kind === 'removed') {
    kindHint = ' — property removed';
  }

  return (
    <div className="form-group bpmn-diff-custom-prop">
      <label>
        {ch.propertyName}
        <span className="bpmn-diff-custom-prop__kind">{kindHint}</span>
      </label>
      <span className={`stubbed-form-control ${isMultiline ? 'stubbed-form-control--textarea' : ''}`}>
        {(ch.kind === 'changed' || ch.kind === 'removed') && (
          <pre className="diff-value diff-value--removed">{beforeText}</pre>
        )}
        {(ch.kind === 'changed' || ch.kind === 'added') && (
          <pre className="diff-value diff-value--added">{afterText}</pre>
        )}
      </span>
    </div>
  );
}

function captializeAttributeName(name: string): string {
  return name
    .split('_')
    .map((namePart) => namePart.substr(0, 1).toUpperCase() + namePart.substring(1))
    .join(' ');
}
