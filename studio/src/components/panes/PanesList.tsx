import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneAreaName, PaneObject } from '@evil/bifrost_fw_sdk';

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
          <ErrorBoundary key={`error_boundary_key_${index}_${pane.id}`} resetKeys={props.editorDocument?.uri}>
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
