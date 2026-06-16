import React, { useCallback } from 'react';

import type { EditorDocument, EditorDocumentModel, PaneGroupObject } from '@evil/bifrost_fw_sdk';

import { useBifrost } from '../../bifrostContext';
import PaneGroupTabBar, { getDisplayableGroups } from './PaneGroupTabBar';
import PanesList from './PanesList';

export type PaneAreaRightProps = {
  className: string;
  paneGroups: PaneGroupObject[];
  editorDocument: EditorDocument | null;
  editorDocumentModel: EditorDocumentModel | null;
};

export default function PaneAreaRight(props: PaneAreaRightProps): React.JSX.Element {
  const bifrost = useBifrost();

  const visibleGroups = getDisplayableGroups(
    props.paneGroups,
    props.editorDocument,
    props.editorDocumentModel,
    bifrost,
  );

  const activeGroup = visibleGroups.find((group) => group.visible) ?? visibleGroups[0] ?? null;
  const activeGroupId = activeGroup?.groupId ?? '';

  const onSelectGroup = useCallback(
    (groupId: string) => {
      bifrost.panes.setActiveGroupInArea('right', groupId);
    },
    [bifrost.panes],
  );

  const showTabBar = visibleGroups.length >= 2;

  return (
    <div className={`${props.className} pane-area-right`}>
      {showTabBar && (
        <PaneGroupTabBar
          groups={props.paneGroups}
          activeGroupId={activeGroupId}
          onSelectGroup={onSelectGroup}
          editorDocument={props.editorDocument}
          editorDocumentModel={props.editorDocumentModel}
          variant="icon"
        />
      )}
      <div className="pane-area-right__content">
        {activeGroup != null && (
          <PanesList
            editorDocument={props.editorDocument}
            editorDocumentModel={props.editorDocumentModel}
            panes={activeGroup.panes}
            paneArea="right"
            paneAreaIndex={props.paneGroups.indexOf(activeGroup)}
            visible={true}
          />
        )}
      </div>
    </div>
  );
}
