import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { FormAction } from '#modules/bpmn-editor/BpmnElementTypes';
import { FormActionPreset } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useEffect, useState } from 'react';

import type { FormBuilderEditorSnapshot } from '../FormBuilderEditorMediator';
import { FormBuilderEditorMediator } from '../FormBuilderEditorMediator';

const FORM_BUILDER_DOCUMENT_TYPE = 'bpmn.form-builder';
const HELP_ID = 'bpmn/properties/form_builder_action';
const MAXIMUM_ACTION_ID_LENGTH = 255;

/** The Engine rejects a blank or over-long `actionId` on finish; duplicates make `token.actionId` ambiguous. */
function isValidActionId(nextId: string, currentId: string, actions: readonly FormAction[]): boolean {
  if (nextId.trim() === '' || nextId.length > MAXIMUM_ACTION_ID_LENGTH) {
    return false;
  }
  return !actions.some((existingAction) => existingAction.id === nextId && existingAction.id !== currentId);
}

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

  const replaceAction = (nextAction: FormAction): void => {
    const updated = snapshot.actions.map((existingAction) =>
      existingAction.id === action.id ? nextAction : existingAction,
    );
    snapshot.setActions(updated);

    if (nextAction.id !== action.id) {
      snapshot.selectAction(nextAction.id);
    }
  };

  const updateAction = (patch: Partial<FormAction>): void => {
    replaceAction({ ...action, ...patch });
  };

  const [invalidIdDraft, setInvalidIdDraft] = useState<string | null>(null);

  const handleIdChange = (nextId: string): void => {
    if (isValidActionId(nextId, action.id, snapshot.actions)) {
      setInvalidIdDraft(null);
      updateAction({ id: nextId });
    } else {
      setInvalidIdDraft(nextId);
    }
  };

  return (
    <>
      <div className="form-group">
        <label className="d-block">ID</label>
        <input
          data-test--action-inspector-id-input
          className="form-control form-control-sm"
          type="text"
          value={invalidIdDraft ?? action.id}
          onChange={(event) => handleIdChange(event.target.value)}
          onBlur={() => setInvalidIdDraft(null)}
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
    </>
  );
}
