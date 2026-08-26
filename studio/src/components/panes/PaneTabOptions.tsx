import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneObject } from '#bifrost/contracts/PaneTypes';

import React from 'react';

import { useBifrost } from '../../bifrostContext';

type PaneTabOptionsProps = {
  pane: PaneObject;
  editorDocument: EditorDocument | null;
  editorDocumentModel: EditorDocumentModel | null;
  dataFromPaneTabOptions?: any;
  onChangeDataFromPaneTabOptions: (data: any) => void;
};

export default function PaneTabOptions(props: PaneTabOptionsProps): React.JSX.Element {
  const bifrost = useBifrost();

  if (props.pane == null) {
    return <div />;
  }

  const paneObject = props.pane;
  const paneProvider = bifrost.panes.getPaneProvider(paneObject.providerId);
  const PaneTabOptionsComponent = paneProvider.PaneTabOptions || DefaultPaneTabOptions;

  return (
    <PaneTabOptionsComponent
      studio={bifrost}
      paneId={paneObject.id}
      editorDocument={props.editorDocument}
      editorDocumentModel={props.editorDocumentModel}
      dataFromPaneTabOptions={props.dataFromPaneTabOptions}
      onChangeDataFromPaneTabOptions={props.onChangeDataFromPaneTabOptions}
    />
  );
}

function DefaultPaneTabOptions(props: any): React.JSX.Element {
  return <div />;
}
