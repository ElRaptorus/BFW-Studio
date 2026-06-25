import React, { useEffect, useState } from 'react';

import type { EditorDocument, PaneComponentProps, PaneProvider } from '@evil/bifrost_fw_sdk';
import { Pane, PaneBody, PaneHeader, PaneHeaderHelpIcon } from '@evil/bifrost_fw_sdk';
import type { FormAction } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';
import { FormActionPreset } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

import type { FormBuilderEditorSnapshot } from '../FormBuilderEditorMediator';
import { FormBuilderEditorMediator } from '../FormBuilderEditorMediator';

const FORM_BUILDER_DOCUMENT_TYPE = 'bpmn.form-builder';
const HELP_ID = 'bpmn/properties/form_builder_action';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Action Properties';
}

function shouldBeDisplayed(editorDocument: EditorDocument): boolean {
  if (editorDocument?.documentType !== FORM_BUILDER_DOCUMENT_TYPE) {
    return false;
  }
  const snapshot = FormBuilderEditorMediator.getSnapshot();
  return snapshot != null && snapshot.selection.type === 'action';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        <PaneHeaderHelpIcon studio={props.studio} id={HELP_ID} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(_props: PaneComponentProps): React.JSX.Element | null {
  const [snapshot, setSnapshot] = useState<FormBuilderEditorSnapshot | null>(FormBuilderEditorMediator.getSnapshot());

  useEffect(() => {
    const subscription = FormBuilderEditorMediator.subscribe(() => {
      setSnapshot(FormBuilderEditorMediator.getSnapshot());
    });
    return () => subscription.dispose();
  }, []);

  if (snapshot == null || snapshot.selection.type !== 'action') {
    return null;
  }

  const actionId = (snapshot.selection as { type: 'action'; actionId: string }).actionId;
  const selectedAction = snapshot.actions.find((action) => action.id === actionId);
  if (selectedAction == null) {
    return null;
  }

  return (
    <PaneBody>
      <ActionPropertiesForm snapshot={snapshot} action={selectedAction} />
    </PaneBody>
  );
}

type ActionPropertiesFormProps = {
  snapshot: FormBuilderEditorSnapshot;
  action: FormAction;
};

function ActionPropertiesForm(props: ActionPropertiesFormProps): React.JSX.Element {
  const { snapshot, action } = props;

  const updateAction = (patch: Partial<FormAction>): void => {
    const updated = snapshot.actions.map((existingAction) =>
      existingAction.id === action.id ? { ...existingAction, ...patch } : existingAction,
    );
    snapshot.setActions(updated);

    if (patch.id != null && patch.id !== action.id) {
      snapshot.selectAction(patch.id);
    }
  };

  return (
    <>
      <div className="form-group">
        <label className="d-block">ID</label>
        <input
          className="form-control form-control-sm"
          type="text"
          value={action.id}
          onChange={(event) => updateAction({ id: event.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="d-block">Label</label>
        <input
          className="form-control form-control-sm"
          type="text"
          value={action.label}
          onChange={(event) => updateAction({ label: event.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="d-block">Preset</label>
        <select
          className="form-control form-control-sm"
          value={action.preset}
          onChange={(event) => updateAction({ preset: event.target.value as FormActionPreset })}
        >
          {Object.values(FormActionPreset).map((preset) => (
            <option key={preset} value={preset}>
              {preset}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-check-label">
          <input
            type="checkbox"
            className="form-check-input"
            checked={action.submitsForm}
            onChange={(event) => updateAction({ submitsForm: event.target.checked })}
          />{' '}
          Submits Form (finishUserTask)
        </label>
      </div>

      <div className="form-group">
        <label className="form-check-label">
          <input
            type="checkbox"
            className="form-check-input"
            checked={action.isDefault ?? false}
            onChange={(event) => updateAction({ isDefault: event.target.checked })}
          />{' '}
          Default (primary styling)
        </label>
      </div>

      <div className="form-group">
        <label className="form-check-label">
          <input
            type="checkbox"
            className="form-check-input"
            checked={action.isDanger ?? false}
            onChange={(event) => updateAction({ isDanger: event.target.checked })}
          />{' '}
          Danger (destructive styling)
        </label>
      </div>
    </>
  );
}
