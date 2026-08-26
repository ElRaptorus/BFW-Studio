import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneAreaName, PaneObject } from '#bifrost/contracts/PaneTypes';

import React from 'react';

import { ErrorBoundary } from '../ErrorBoundary';
import PaneWrapper from './PaneWrapper';

type PanesListProps = {
  editorDocument: EditorDocument | null;
  editorDocumentModel: EditorDocumentModel | null;
  panes: PaneObject[];
  paneArea: PaneAreaName;
  paneAreaIndex: number;
  visible: boolean;
};

export default function PanesList(props: PanesListProps): React.JSX.Element | null {
  return (
    <>
      {props.visible &&
        props.panes.map((pane: PaneObject, index: number) => (
          <ErrorBoundary key={pane.id} resetKeys={props.editorDocument?.uri}>
            <PaneWrapper
              editorDocument={props.editorDocument as EditorDocument}
              editorDocumentModel={props.editorDocumentModel as EditorDocumentModel}
              pane={pane}
              paneArea={props.paneArea}
              paneAreaIndex={props.paneAreaIndex}
              index={index}
            />
          </ErrorBoundary>
        ))}
    </>
  );
}
