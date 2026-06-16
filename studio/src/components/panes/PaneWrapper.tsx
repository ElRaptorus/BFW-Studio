import React, { useCallback } from 'react';

import type { EditorDocument, EditorDocumentModel, PaneAreaName, PaneObject, Studio } from '@evil/bifrost_fw_sdk';

import { useBifrost } from '../../bifrostContext';

type PaneProps = {
  editorDocument: EditorDocument;
  editorDocumentModel: EditorDocumentModel;
  pane: PaneObject;
  paneArea: PaneAreaName;
  paneAreaIndex: number;
  index: number;
};

export default function PaneWrapper(props: PaneProps): React.JSX.Element | null {
  const bifrost = useBifrost();
  const paneProvider = bifrost.panes.getPaneProvider(props.pane.providerId);

  const evaluateCssClassNames = useCallback(
    (
      classNames:
        | string
        | ((
            editorDocument: EditorDocument,
            editorDocumentModel: EditorDocumentModel,
            studio: Studio,
            pane: PaneObject,
          ) => string),
    ): string => {
      if (typeof classNames === 'function') {
        return classNames(props.editorDocument, props.editorDocumentModel, bifrost, props.pane);
      }

      return classNames;
    },
    [props.editorDocument, props.editorDocumentModel, bifrost, props.pane],
  );

  if (
    paneProvider.shouldBeDisplayed &&
    !paneProvider.shouldBeDisplayed(props.editorDocument, props.editorDocumentModel, bifrost)
  ) {
    return null;
  }

  const classNames = paneProvider.classNames ? evaluateCssClassNames(paneProvider.classNames) : '';
  const PaneComponent = paneProvider.Pane;

  return (
    <div
      className={`pane ${classNames}`}
      key={`pane_object_id_${props.pane.id}`}
      data-pane-id={props.pane.id}
      data-test--pane={props.pane.id}
    >
      <PaneComponent
        studio={bifrost}
        editorDocument={props.editorDocument}
        editorDocumentModel={props.editorDocumentModel}
        paneId={props.pane.id}
        collapsed={props.pane.collapsed}
      />
    </div>
  );
}
