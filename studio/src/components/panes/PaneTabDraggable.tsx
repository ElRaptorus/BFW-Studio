import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneAreaName, PaneObject } from '#bifrost/contracts/PaneTypes';
import { useDragSource, useDropTarget } from '#components/DragAndDrop';

import React from 'react';

import { useBifrost } from '../../bifrostContext';

type PanesTabProps = {
  editorDocument: EditorDocument;
  editorDocumentModel: EditorDocumentModel;
  index: number;
  isActive: boolean;
  pane: PaneObject;
  paneArea: PaneAreaName;
  paneAreaIndex: number;

  activatePaneTab: (index: number) => void;
  movePane: (
    origPaneArea: PaneAreaName,
    origPaneAreaIndex: number,
    origIndex: number,
    destPaneArea: PaneAreaName,
    destPaneAreaIndex: number,
    destIndex: number,
  ) => void;
};

export default function PaneTabDraggable(props: PanesTabProps): React.JSX.Element {
  const bifrost = useBifrost();
  const editorDocument = props.editorDocument;
  const editorDocumentModel = props.editorDocumentModel;
  const paneObject = props.pane;
  const isActive = props.isActive;
  const paneProvider = bifrost.panes.getPaneProvider(paneObject.providerId);
  const title =
    (paneProvider.getPaneTitle && paneProvider.getPaneTitle(editorDocument, editorDocumentModel, bifrost)) ||
    paneObject.id;

  const { isDragging, dragSourceProps } = useDragSource({
    type: 'pane',
    getItem: () => ({
      paneArea: props.paneArea,
      paneAreaIndex: props.paneAreaIndex,
      index: props.index,
    }),
  });

  const { isOver, dropTargetProps } = useDropTarget({
    accept: ['pane'],
    onDrop: ({ item }) => {
      props.movePane(item.paneArea, item.paneAreaIndex, item.index, props.paneArea, props.paneAreaIndex, props.index);
    },
  });

  const classNames = [
    'pane-tab',
    isActive ? 'pane-tab--active' : '',
    isOver ? 'pane-tab--over' : '',
    isDragging ? 'pane-tab--dragging' : '',
  ];

  return (
    <span {...dropTargetProps}>
      <span {...dragSourceProps} className={classNames.join(' ')} onClick={() => props.activatePaneTab(props.index)}>
        <span>{title}</span>
      </span>
    </span>
  );
}
