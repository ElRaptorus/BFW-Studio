import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneGroupObject } from '#bifrost/contracts/PaneTypes';

import React from 'react';

import { useBifrost } from '../../bifrostContext';
import { getDisplayableGroups } from './PaneGroupTabBar';
import PanesList from './PanesList';

export type PaneAreaLeftProps = {
  className: string;
  paneGroups: PaneGroupObject[];
  editorDocument: EditorDocument | null;
  editorDocumentModel: EditorDocumentModel | null;
};

export default function PaneAreaLeft(props: PaneAreaLeftProps): React.JSX.Element {
  const bifrost = useBifrost();

  const displayableGroups = getDisplayableGroups(
    props.paneGroups,
    props.editorDocument,
    props.editorDocumentModel,
    bifrost,
  );
  const activeGroupId = (displayableGroups.find((group) => group.visible) ?? displayableGroups[0])?.groupId ?? '';

  return (
    <div className={props.className}>
      {props.paneGroups.map((paneGroup: PaneGroupObject, index: number) => (
        <PanesList
          editorDocument={props.editorDocument}
          editorDocumentModel={props.editorDocumentModel}
          panes={paneGroup.panes}
          paneArea="left"
          paneAreaIndex={index}
          key={paneGroup.groupId}
          visible={paneGroup.groupId === activeGroupId}
        />
      ))}
    </div>
  );
}
