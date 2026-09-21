import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import type EngineBpmnDebuggerEditorDocumentModel from '../../EngineBpmnDebuggerEditorDocumentModel';
import { JumpToSymbolInSolutionLink } from '../JumpToSymbolInSolutionLink';
import { shouldDisplayCollapsedPoolPane } from '../ShouldBeDisplayedConditions';

type CollapsedPoolProps = PaneComponentProps & {
  editorDocumentModel: EngineBpmnDebuggerEditorDocumentModel;
};

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldDisplayCollapsedPoolPane,
  Pane: PaneFull,
  PaneContent: CollapsedPoolPane,
};

function getPaneTitle(): string {
  return 'Collapsed Pool';
}

function PaneFull(props: CollapsedPoolProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <CollapsedPoolPane {...props} />}
    </Pane>
  );
}

function CollapsedPoolPane(props: CollapsedPoolProps): React.JSX.Element | null {
  const model = props.editorDocumentModel as EngineBpmnDebuggerEditorDocumentModel;
  if (!model.processInstance) {
    return null;
  }
  const selectedElements = model.selectedElements;
  const selectedParticipant = selectedElements[0];

  return (
    <PaneBody>
      {selectedParticipant?.name && (
        <PaneProperty type="text" label="Model Name" disabled={true} value={selectedParticipant?.name ?? ''} />
      )}
      <PaneProperty
        type="text"
        label={
          <>
            Participant ID{' '}
            <JumpToSymbolInSolutionLink
              studio={props.studio}
              definitionId={model.processInstance?.processModelId ?? ''}
              elementId={selectedParticipant.id ?? ''}
            />
          </>
        }
        disabled={true}
        value={selectedParticipant.id}
      />
    </PaneBody>
  );
}
