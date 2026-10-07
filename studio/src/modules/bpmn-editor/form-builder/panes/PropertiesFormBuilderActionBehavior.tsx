import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderHelpIcon } from '#components/panes/PaneHeaderHelpIcon';
import type { FormAction, FormActionEffect } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useEffect, useState } from 'react';

import type { FormBuilderEditorSnapshot } from '../FormBuilderEditorMediator';
import { FormBuilderEditorMediator } from '../FormBuilderEditorMediator';

const EFFECT_OPTIONS: readonly { effect: FormActionEffect; label: string }[] = [
  { effect: 'submit', label: 'Submits User Task' },
  { effect: 'dismiss', label: 'Closes Form Only' },
  { effect: 'abort', label: 'Cancels User Task' },
];

const FORM_BUILDER_DOCUMENT_TYPE = 'bpmn.form-builder';
const HELP_ID = 'bpmn/properties/form_builder_action';

function withEffect(action: FormAction, effect: FormActionEffect): FormAction {
  if (effect === 'submit') {
    return { ...action, effect };
  }
  const { skipsValidation: _skipsValidation, ...actionWithoutSkip } = action;
  return { ...actionWithoutSkip, effect };
}

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Behavior';
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

  return (
    <>
      <div className="form-group">
        <span className="d-block">Effect</span>
        {EFFECT_OPTIONS.map((option) => (
          <label key={option.effect} className="form-check-label d-block">
            <input
              type="radio"
              className="form-check-input"
              name={`form-action-effect-${action.id}`}
              value={option.effect}
              checked={action.effect === option.effect}
              data-test--action-inspector-effect={option.effect}
              onChange={() => replaceAction(withEffect(action, option.effect))}
            />{' '}
            {option.label}
          </label>
        ))}
      </div>

      {action.effect === 'submit' && (
        <div className="form-group">
          <label className="form-check-label">
            <input
              type="checkbox"
              className="form-check-input"
              data-test--action-inspector-skips-validation
              checked={action.skipsValidation === true}
              onChange={(event) => updateAction({ skipsValidation: event.target.checked || undefined })}
            />{' '}
            Skips validation
          </label>
        </div>
      )}
    </>
  );
}
