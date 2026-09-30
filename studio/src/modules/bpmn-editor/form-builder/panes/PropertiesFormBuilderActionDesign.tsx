import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';
import type { FormAction } from '#modules/bpmn-editor/BpmnElementTypes';

import React, { useEffect, useState } from 'react';

import type { FormBuilderEditorSnapshot } from '../FormBuilderEditorMediator';
import { FormBuilderEditorMediator } from '../FormBuilderEditorMediator';

const FORM_BUILDER_DOCUMENT_TYPE = 'bpmn.form-builder';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Design';
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
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
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
