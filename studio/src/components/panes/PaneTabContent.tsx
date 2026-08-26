import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneObject } from '#bifrost/contracts/PaneTypes';

import React from 'react';

import { useBifrost } from '../../bifrostContext';

type PaneTabContentProps = {
  pane: PaneObject;
  editorDocument: EditorDocument | null;
  editorDocumentModel: EditorDocumentModel | null;
  dataFromPaneTabOptions: any;
};

export default function PaneTabContent(props: PaneTabContentProps): React.JSX.Element {
  const bifrost = useBifrost();

  if (props.pane == null) {
    return <div className="pane__content pane__content--empty" />;
  }

  const paneObject = props.pane;
  const paneProvider = bifrost.panes.getPaneProvider(paneObject.providerId);

  const PaneContent = paneProvider.PaneContent;

  return (
    <PaneContent
      studio={bifrost}
      editorDocument={props.editorDocument}
      editorDocumentModel={props.editorDocumentModel}
      dataFromPaneTabOptions={props.dataFromPaneTabOptions}
    />
  );
}
