import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneGroupObject } from '#bifrost/contracts/PaneTypes';

import React from 'react';

import PanesList from './PanesList';

export type PaneAreaLeftProps = {
  className: string;
  paneGroups: PaneGroupObject[];
  editorDocument: EditorDocument | null;
  editorDocumentModel: EditorDocumentModel | null;
};

export default function PaneAreaLeft(props: PaneAreaLeftProps): React.JSX.Element {
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
          visible={paneGroup.visible}
        />
      ))}
    </div>
  );
}
