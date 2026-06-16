import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneGroupObject } from '@evil/bifrost_fw_sdk';

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
          key={`pane-area-left-${index}`}
          visible={paneGroup.visible}
        />
      ))}
    </div>
  );
}
