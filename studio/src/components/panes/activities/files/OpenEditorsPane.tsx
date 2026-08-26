import { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorAreaLayout_Editor, EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import type { TreeItem } from '#bifrost/contracts/TreeTypes';
import { useScrollPositionManager } from '#components/ScrollPositionManager';
import { Tree } from '#components/Tree/Tree';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderIcon } from '#components/panes/PaneHeaderIcon';

import React from 'react';

import { Icon } from '../../../Icon';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  Pane: PaneFull,
  PaneContent: PaneContent,
  classNames: 'app-layout__open-editors-pane',
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane classNames="app-layout__full-height-pane">
      <PaneHeader
        studio={props.studio}
        title={getPaneTitle(props.editorDocument, props.editorDocumentModel, props.studio)}
        className="pane-header--hero"
        paneId={props.paneId}
        collapsed={props.collapsed}
      >
        <PaneTabOptions {...props} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

export function getPaneTitle(
  editorDocument: EditorDocument,
  editorDocumentModel: EditorDocumentModel,
  studio: Bifrost,
): string {
  const editors = Bifrost.cast(studio).editors.getOpenEditors();

  const totalEditorDocuments = editors.reduce((acc, editor) => {
    return acc + editor.editorDocuments.length;
  }, 0);

  return `Open Editors (${totalEditorDocuments})`;
}

export function PaneTabOptions(props: PaneComponentProps): React.JSX.Element | null {
  return !props.collapsed && Bifrost.cast(props.studio).editors.getOpenEditors().length > 0 ? (
    <>
      <PaneHeaderIcon
        studio={props.studio}
        icon="ph ph-x-square"
        command="std.editor.closeAllEditorDocuments"
        tooltip="Close all editors"
      />
    </>
  ) : null;
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost: Bifrost = Bifrost.cast(props.studio);

  const fileExplorerView = bifrost.fileExplorerView;
  const fileExplorerViewData = fileExplorerView.getViewData();

  const solutionEntry = JSON.parse(JSON.stringify(fileExplorerViewData.solution));

  const editors = bifrost.editors.getOpenEditors();
  const openEditorEntries = getOpenEditorEntries(bifrost, editors);

  if (solutionEntry != null) {
    const solutionHasOneProject = solutionEntry.entries.length === 1 && solutionEntry.entries[0].type === 'project';
    if (solutionHasOneProject) {
      const projectEntry = solutionEntry.entries[0];
      solutionEntry.entries = projectEntry.entries;
    }
  }

  const onClick = (metadata: any): void => {
    if (metadata && metadata.openUriOnClick === true) {
      bifrost.commands.executeCommand('std.editor.focusOrOpenDocument', [metadata.uri]);
    }
  };

  const onDoubleClick = (metadata: any): void => {
    if (metadata && metadata.openUriOnClick === true) {
      bifrost.commands.executeCommand('std.editor.persistTemporaryTabIfExists', [metadata.uri]);
    }
  };

  const onActionIconClick = (item) => {
    const editorDocument = bifrost.editors.getEditorDocumentByUri(item.metadata.uri);
    bifrost.commands.executeCommand('std.editor.closeEditorDocument', [editorDocument]);
  };

  const dragAndDropHandler = (draggedItem, dropTarget) => {
    bifrost.editors.moveAndActivateEditorDocumentByEditorIdAndIndex(
      draggedItem.metadata.dndData.editorId,
      draggedItem.metadata.dndData.index,
      dropTarget.metadata.dndData.editorId,
      dropTarget.metadata.dndData.index,
    );
  };

  const connectScrollTarget = useScrollPositionManager('open-editors-scroll');

  return (
    <>
      <div
        ref={connectScrollTarget}
        className="pane__content pane__content--treeview pane__content--scroll-vertically treeview--open-editors-container"
      >
        <Tree
          studio={props.studio}
          viewMediatorId="std/file-explorer/open-editors"
          className="treeview--open-editors"
          entries={openEditorEntries}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onActionIconClick={onActionIconClick}
          onDragAndDropItem={dragAndDropHandler}
          iconComponent={Icon}
          decorationSource={bifrost.fileExplorerView.getDecorationSource()}
        />
      </div>
    </>
  );
}

function getOpenEditorEntries(bifrost: Bifrost, editors: EditorAreaLayout_Editor[]): TreeItem[] {
  if (editors.length === 0) {
    return [];
  }

  const focusedEditorDocumentUri = bifrost.editors.getFocusedEditorDocument()?.uri;
  if (editors.length === 1) {
    return getOpenEditorDocumentEntries(editors[0], focusedEditorDocumentUri);
  }

  return editors.map((editor, index) => {
    return {
      type: 'section',
      subtype: 'list',
      label: `Group ${index + 1}`,
      expanded: true,
      entries: getOpenEditorDocumentEntries(editor, focusedEditorDocumentUri),
    };
  });
}

function getOpenEditorDocumentEntries(editor: EditorAreaLayout_Editor, focusedEditorDocumentUri?: string): TreeItem[] {
  return editor.editorDocuments.map((editorDocument, index): TreeItem => {
    return {
      type: 'file',
      actionIcon: editorDocument.hasUnsavedChanges ? 'ph ph-circle treeview__icon--ph-action-circle' : undefined,
      actionIconOnHover: 'ph ph-x treeview__icon--ph-action-close',
      actionTooltip: editorDocument.hasUnsavedChanges ? 'Has unsaved changes' : undefined,
      label: editorDocument.label,
      labelIcon: editorDocument.icon || 'bifrost tree/file',
      labelTooltip: editorDocument.uri,
      selected: editorDocument.uri === focusedEditorDocumentUri,
      metadata: {
        openUriOnClick: true,
        uri: editorDocument.uri,
        dndData: { editorId: editor.editorId, index: index },
        isTemporary: editorDocument.isTemporary,
      },
      menuId: 'std/editor/editor-tab',
    };
  });
}
