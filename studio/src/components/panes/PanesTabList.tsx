import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneAreaName, PaneObject } from '#bifrost/contracts/PaneTypes';
import { AutoScrollContainer } from '#components/AutoScrollContainer';
import { useDropTarget } from '#components/DragAndDrop';

import React from 'react';

import { useBifrost } from '../../bifrostContext';
import { ErrorBoundary } from '../ErrorBoundary';
import PaneTabDraggable from './PaneTabDraggable';

type PanesTabListProps = {
  activePane: PaneObject;
  editorDocument: EditorDocument;
  editorDocumentModel: EditorDocumentModel;
  paneArea: PaneAreaName;
  paneAreaIndex: number;
  panes: PaneObject[];

  activatePaneTab: (index: number) => void;
  movePane: (
    origPaneArea: PaneAreaName,
    origPaneAreaIndex: number,
    origIndex: number,
    destPaneArea: PaneAreaName,
    destPaneAreaIndex: number,
    destIndex: number,
  ) => void;

  isFocusedEditor?: boolean;
};

export default function PanesTabList(props: PanesTabListProps): React.JSX.Element {
  const bifrost = useBifrost();
  const { movePane } = props;

  const { isOver, dropTargetProps } = useDropTarget({
    accept: ['pane'],
    onDrop: ({ item }) => {
      const maxExistingIndex = props.panes.length - 1;
      const samePaneArea = item.paneArea === props.paneArea;
      const destIndex = samePaneArea ? maxExistingIndex : maxExistingIndex + 1;

      props.movePane(item.paneArea, item.paneAreaIndex, item.index, props.paneArea, props.paneAreaIndex, destIndex);
    },
  });

  const classNames = [
    'tabs',
    'tabs--pane-tabs',
    props.isFocusedEditor ? 'tabs--focused' : '',
    isOver ? 'tabs--over' : '',
  ];

  const shouldDisplayTabForPane = (pane: PaneObject): boolean => {
    const paneTabListProps = props as PanesTabListProps;
    const paneProvider = bifrost.panes.getPaneProvider(pane.providerId);
    if (paneProvider.shouldBeDisplayed == null) {
      return true;
    }

    return paneProvider.shouldBeDisplayed(
      paneTabListProps.editorDocument,
      paneTabListProps.editorDocumentModel,
      bifrost,
    );
  };

  return (
    <div {...dropTargetProps} className={classNames.join(' ')}>
      <AutoScrollContainer className="tabs__inner" elementClassName="pane-tab--active">
        {props.panes.map((pane: PaneObject, index: number) => {
          const displayTab = shouldDisplayTabForPane(pane);
          if (!displayTab) {
            return null;
          }

          const isActive = pane === props.activePane;

          return (
            <ErrorBoundary key={pane.id}>
              <PaneTabDraggable
                editorDocument={props.editorDocument}
                editorDocumentModel={props.editorDocumentModel}
                pane={pane}
                isActive={isActive}
                paneArea={props.paneArea}
                paneAreaIndex={props.paneAreaIndex}
                index={index}
                key={pane.id}
                activatePaneTab={props.activatePaneTab}
                movePane={movePane}
              />
            </ErrorBoundary>
          );
        })}
      </AutoScrollContainer>
    </div>
  );
}
