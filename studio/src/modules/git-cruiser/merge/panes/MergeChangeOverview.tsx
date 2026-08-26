import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Merge Changes',
  shouldBeDisplayed: (document: EditorDocument, model: any): boolean => {
    const isMergeEditor = document?.modelKey === 'MergeDocumentModel' && model != null;
    if (!isMergeEditor) {
      return false;
    }
    return model?.resolveResolverComponent() == null;
  },
  Pane: PaneFull,
  PaneContent: PaneContentWrapper,
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title="Merge Changes" paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContentWrapper {...props} />}
    </Pane>
  );
}

function PaneContentWrapper(props: PaneComponentProps): React.JSX.Element {
  return (
    <PaneBody>
      <PaneContent {...props} />
    </PaneBody>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  return (
    <div className="merge-overview">
      <div className="merge-overview__empty">
        <br />
        <span style={{ fontStyle: 'italic' }}>Use the right diff editor to review and resolve conflicts.</span>
      </div>
    </div>
  );
}
