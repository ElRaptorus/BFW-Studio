import { useDrag, useDrop } from 'react-dnd';

import React from 'react';

import type { EditorDocument, EditorDocumentModel, PaneAreaName, PaneObject } from '@evil/bifrost_fw_sdk';

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

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'pane',
    item: {
      paneArea: props.paneArea,
      paneAreaIndex: props.paneAreaIndex,
      index: props.index,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'pane',
    drop: (draggedItem: any) => {
      props.movePane(
        draggedItem.paneArea,
        draggedItem.paneAreaIndex,
        draggedItem.index,
        props.paneArea,
        props.paneAreaIndex,
        props.index,
      );
    },
    collect: (monitor: any) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const classNames = [
    'pane-tab',
    isActive ? 'pane-tab--active' : '',
    isOver ? 'pane-tab--over' : '',
    isDragging ? 'pane-tab--dragging' : '',
  ];

  return (
    <span ref={drop as any}>
      <span
        ref={drag as any}
        className={classNames.join(' ')}
        onClick={() => props.activatePaneTab(props.index)}
        key={paneObject.id}
      >
        <span>{title}</span>
      </span>
    </span>
  );
}
