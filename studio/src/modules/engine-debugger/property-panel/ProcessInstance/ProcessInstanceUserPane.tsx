import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@evil/bifrost_fw_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { shouldDisplayProcessInstanceInfoPane } from '../ShouldBeDisplayedConditions';

type ProcessInstanceUserPaneProps = PaneComponentProps & {
  editorDocumentModel: EngineBpmnDebuggerEditorDocumentModel;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayProcessInstanceInfoPane,
  Pane: PaneFull,
  PaneContent: ProcessInstanceUserPane,
};

function getPaneTitle(): string {
  return 'User Info';
}

function PaneFull(props: ProcessInstanceUserPaneProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <ProcessInstanceUserPane {...props} />}
    </Pane>
  );
}

function formatIdentityField(startedBy: Record<string, unknown> | null, field: string): string {
  const value = startedBy?.[field];
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function ProcessInstanceUserPane(props: ProcessInstanceUserPaneProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  if (!model.processInstance) {
    return null;
  }

  const startedBy = model.processInstance.startedBy;

  return (
    <PaneBody>
      <PaneProperty type="text" label="Started by (ID)" disabled={true} value={formatIdentityField(startedBy, 'id')} />
      <PaneProperty
        type="text"
        label="Started by (Roles)"
        disabled={true}
        value={formatIdentityField(startedBy, 'roles')}
      />
      <PaneProperty
        type="text"
        label="Started by (Groups)"
        disabled={true}
        value={formatIdentityField(startedBy, 'groups')}
      />
    </PaneBody>
  );
}
