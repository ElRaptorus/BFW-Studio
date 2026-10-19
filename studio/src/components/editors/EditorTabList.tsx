import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { IconComponent } from '#bifrost/contracts/IconTypes';
import { AutoScrollContainer } from '#components/AutoScrollContainer';
import { useDropTarget } from '#components/DragAndDrop';

import React from 'react';

import EditorTabDraggable from './EditorTabDraggable';
import EditorTabListControls from './EditorTabListControls';

type EditorTabListProps = {
  iconComponent: IconComponent;
  editorDocuments: EditorDocument[];
  activeEditorDocument: EditorDocument;
  isFocusedEditor: boolean;
  focusedEditorDocumentUri: string;
  focusedEditorDocumentParentUri: string;
  editorId: string;
  moveEditorDocument: (origEditorId: string, origIndex: number, destEditorId: string, destIndex: number) => void;
  closeEditorDocument: (editorDocument: EditorDocument) => void;
  focusEditorDocument: (editorDocument: EditorDocument) => void;
  persistEditorDocument: (editorDocument: EditorDocument) => void;
};

export default function EditorTabList(props: EditorTabListProps): React.JSX.Element {
  const { isOver, dropTargetProps } = useDropTarget({
    accept: ['editor_tab'],
    onDrop: ({ item }) => {
      const maxExistingIndex = props.editorDocuments.length - 1;
      const sameEditor = item.editorId === props.editorId;
      const destIndex = sameEditor ? maxExistingIndex : maxExistingIndex + 1;

      props.moveEditorDocument(item.editorId, item.index, props.editorId, destIndex);
    },
  });

  const classNames = [
    'tabs',
    'tabs--overflow',
    props.isFocusedEditor ? 'tabs--focused' : '',
    isOver ? 'tabs--over' : '',
  ];
  const autoScrollElementClassName = props.isFocusedEditor ? 'editor-tab--focused' : 'editor-tab--active';
  const Icon = props.iconComponent;

  return (
    <div className={classNames.join(' ')} {...dropTargetProps}>
      <AutoScrollContainer className="tabs__inner" elementClassName={autoScrollElementClassName}>
        {props.editorDocuments.map((editorDocument: EditorDocument, index: number) => {
          const active = props.activeEditorDocument === editorDocument;
          const icon = Icon == null ? null : <Icon id={editorDocument.icon} />;

          return (
            <EditorTabDraggable
              active={active}
              focusedEditorDocumentUri={props.focusedEditorDocumentUri}
              focusedEditorDocumentParentUri={props.focusedEditorDocumentParentUri}
              isFocusedEditor={props.isFocusedEditor}
              editorDocument={editorDocument}
              editorId={props.editorId}
              icon={icon}
              index={index}
              key={editorDocument.uri}
              focusEditorDocument={props.focusEditorDocument}
              moveEditorDocument={props.moveEditorDocument}
              closeEditorDocument={props.closeEditorDocument}
              persistEditorDocument={props.persistEditorDocument}
            />
          );
        })}
      </AutoScrollContainer>
      <EditorTabListControls
        activeEditorDocument={props.activeEditorDocument}
        editorDocuments={props.editorDocuments}
      />
    </div>
  );
}
