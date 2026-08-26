import { isUrlForOpenInNewTab, parseOpenInNewTabUrl } from '#bifrost/common/OpenInNewTabUrl';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { showContextMenu } from '#components/ContextMenuFunctions';
import { useDecoration } from '#components/Tree/DecorationContext';
import { useDrag, useDrop } from 'react-dnd';

import React, { useCallback } from 'react';

import { useBifrost } from '../../bifrostContext';
import { Icon } from '../Icon';

type EditorTabProps = {
  editorDocument: EditorDocument;
  isFocusedEditor: boolean;
  active: boolean;
  index: number;
  icon: React.JSX.Element | null;

  focusedEditorDocumentUri: string;
  focusedEditorDocumentParentUri: string;
  editorId: string;
  moveEditorDocument: (origEditorId: string, origIndex: number, destEditorId: string, destIndex: number) => void;
  closeEditorDocument: (editorDocument: EditorDocument) => void;
  focusEditorDocument: (editorDocument: EditorDocument) => void;
  persistEditorDocument: (editorDocument: EditorDocument) => void;
};

function getTooltipText(editorDocument: EditorDocument): string {
  if (editorDocument.uri.match(/^file:\/\//)) {
    return editorDocument.uri.replace('file://', '');
  }
  return editorDocument.label ?? editorDocument.uri;
}

export default function EditorTabDraggable(props: EditorTabProps): React.JSX.Element {
  const bifrost = useBifrost();
  const {
    editorDocument,
    closeEditorDocument,
    focusEditorDocument,
    persistEditorDocument,
    isFocusedEditor,
    active,
    index,
    icon,
    focusedEditorDocumentUri,
    focusedEditorDocumentParentUri,
    editorId,
    moveEditorDocument,
  } = props;
  const tooltipText = getTooltipText(editorDocument);
  const decoration = useDecoration(editorDocument.uri);

  const closeEditorTab = useCallback(
    (event: any): void => {
      event.stopPropagation();
      closeEditorDocument(editorDocument);
    },
    [editorDocument, closeEditorDocument],
  );

  const onClick = useCallback(
    (event: any): void => {
      const isLeftMouseButton = event.button === 0;
      const clickedOnContextMenuItem = event.target?.classList?.contains?.('react-contextmenu-item');
      if (clickedOnContextMenuItem) {
        return;
      }

      if (isLeftMouseButton) {
        event.stopPropagation();
        focusEditorDocument(editorDocument);
      }
    },
    [editorDocument, focusEditorDocument],
  );

  const onDoubleClick = useCallback(
    (event: React.MouseEvent): void => {
      event.stopPropagation();
      persistEditorDocument(editorDocument);
    },
    [editorDocument, persistEditorDocument],
  );

  const onContextMenu = useCallback(
    (event: any): void => {
      event.stopPropagation();
      showContextMenu(event, 'std/editor/editor-tab', [editorDocument, bifrost]);
    },
    [editorDocument, bifrost],
  );

  const onAuxClick = useCallback(
    (event: any): void => {
      const isMiddleMouseButton = event.button === 1;
      if (isMiddleMouseButton) {
        closeEditorTab(event);
      }
    },
    [closeEditorTab],
  );

  const onMouseDown = useCallback((event: any): void => {
    const isMiddleMouseButton = event.button === 1;

    if (isMiddleMouseButton) {
      event.preventDefault();
    }
  }, []);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'editor_tab',
    item: {
      editorId,
      index,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'editor_tab',
    drop: (draggedItem: any) => {
      moveEditorDocument(draggedItem.editorId, draggedItem.index, editorId, index);
    },
    collect: (monitor: any) => ({
      isOver: monitor.isOver(),
    }),
  }));

  let activeOrFocused = '';
  if (isFocusedEditor && active) {
    activeOrFocused = 'editor-tab--focused';
  } else if (active) {
    activeOrFocused = 'editor-tab--active';
  }

  let fragmentClasses = '';
  const isParentOfFocusedEditorDocument = editorDocument.uri === focusedEditorDocumentParentUri;
  if (isParentOfFocusedEditorDocument) {
    fragmentClasses = 'editor-tab--is-parent-of-focused';
  } else if (isUrlForOpenInNewTab(editorDocument.uri)) {
    const fragment = parseOpenInNewTabUrl(editorDocument.uri);
    const parentIsFocusedEditorDocument = fragment.parentUri === focusedEditorDocumentUri;
    const focusedDocumentHasSameParent = fragment.parentUri === focusedEditorDocumentParentUri;

    if (parentIsFocusedEditorDocument) {
      fragmentClasses = 'editor-tab--parent-is-focused';
    } else if (focusedDocumentHasSameParent) {
      fragmentClasses = 'editor-tab--focused-has-same-parent';
    }
  }

  const classNames = [
    'editor-tab',
    activeOrFocused,
    fragmentClasses,
    isOver ? 'editor-tab--over' : '',
    isDragging ? 'editor-tab--dragging' : '',
    editorDocument.hasUnsavedChanges ? 'editor-tab--edited' : '',
    editorDocument.isTemporary ? 'editor-tab--temporary' : '',
  ];

  return (
    <div ref={drop as any}>
      <div
        className={classNames.join(' ')}
        onAuxClick={onAuxClick}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
        onContextMenu={onContextMenu}
        data-bs-title={tooltipText}
        data-bs-toggle="tooltip"
        data-test--editor-tab-label={editorDocument.label}
        ref={drag as any}
      >
        <div className="editor-tab__inner">
          <span className="editor-tab__icon">{icon}</span>
          <span
            className="editor-tab__label"
            style={decoration?.styles?.labelColor ? { color: decoration.styles.labelColor } : undefined}
          >
            {editorDocument.label}
          </span>
          <div className="editor-tab__close">
            <div className="editor-tab-close-icon" onClick={closeEditorTab}>
              {editorDocument.hasUnsavedChanges && (
                <span className="editor-tab-close-icon__icon-edited">
                  <Icon id="ph ph-circle" />
                </span>
              )}
              <span className="editor-tab-close-icon__icon-close">
                <Icon id="ph ph-x" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
