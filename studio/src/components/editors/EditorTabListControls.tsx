import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import { showContextMenu } from '#components/ContextMenuFunctions';

import React, { useCallback } from 'react';

import { useBifrost } from '../../bifrostContext';
import { Icon } from '../Icon';

type EditorTabListControlsProps = {
  editorDocuments: EditorDocument[];
  activeEditorDocument: EditorDocument;
};

export default function EditorTabListControls(props: EditorTabListControlsProps): React.JSX.Element {
  const bifrost = useBifrost();
  const canSplitEditor = props.activeEditorDocument
    ? bifrost.editors.canSplitEditor(props.activeEditorDocument)
    : false;

  const onSplitButtonClick = useCallback(
    (event: any): void => {
      event.stopPropagation();

      if (event.shiftKey) {
        bifrost.commands.executeCommand('std.editor.splitToTheBottom', [props.activeEditorDocument, bifrost]);
      } else {
        bifrost.commands.executeCommand('std.editor.splitToTheRight', [props.activeEditorDocument, bifrost]);
      }
    },
    [props.activeEditorDocument, bifrost],
  );

  const onMoreButtonClick = useCallback(
    (event: any): void => {
      event.stopPropagation();
      showContextMenu(event, 'std/editor/editor-tab-list-controls/more', [props.editorDocuments, bifrost]);
    },
    [props.editorDocuments, bifrost],
  );

  return (
    <div className="editor-tab-list-controls">
      <div className="editor-tab-list-controls__inner">
        {canSplitEditor && (
          <span
            className="editor-tab-list-controls-icon"
            data-bs-title="Split Editor Right, [⇧] Split Editor Down"
            onClick={onSplitButtonClick}
            data-bs-toggle="tooltip"
          >
            <Icon id="std/editor-tab/controls/splitview" />
          </span>
        )}
        <span
          className="editor-tab-list-controls-icon"
          data-bs-title="Tab Actions"
          onClick={onMoreButtonClick}
          data-bs-toggle="tooltip"
        >
          <Icon id="std/editor-tab/controls/dots" />
        </span>
      </div>
    </div>
  );
}
