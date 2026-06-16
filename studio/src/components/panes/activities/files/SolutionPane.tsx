import { Bifrost } from '#bifrost/Bifrost';
import { useScrollPositionManager } from '#components/ScrollPositionManager';
import { useDrop } from 'react-dnd';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import type {
  EditorDocument,
  EditorDocumentModel,
  PaneComponentProps,
  PaneProvider,
  Studio,
  TreeViewMediator,
} from '@evil/bifrost_fw_sdk';
import { Icon, NATIVE_FILE_TYPE, Pane, PaneHeader, PaneHeaderIcon, Tree } from '@evil/bifrost_fw_sdk';

const GET_PATHS_COMMAND = 'std.internal.getPathsFromFiles';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  Pane: PaneFull,
  PaneContent: PaneContent,
  classNames: 'app-layout__solution-pane',
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
  studio: Studio,
): string {
  const solution = Bifrost.cast(studio).fileExplorerView.getViewData().solution;
  const solutionName = solution ? solution.label : 'Explorer';

  return solutionName;
}

export function PaneTabOptions(props: PaneComponentProps): React.JSX.Element | null {
  const bifrost: Bifrost = Bifrost.cast(props.studio);
  const solution = bifrost.solution.getSolution();

  if (props.collapsed) {
    return null;
  }

  return (
    <>
      <PaneHeaderIcon studio={bifrost} icon="ph ph-file-plus" command="std.solution.newFile" tooltip="New file..." />
      <PaneHeaderIcon
        studio={bifrost}
        icon="ph ph-folder-plus"
        command="std.solution.addDirectory"
        tooltip="New directory..."
      />
      {solution != null && solution.isExplicitSolution === true && (
        <PaneHeaderIcon
          studio={bifrost}
          icon="ph ph-package"
          command="std.solution.addFolder"
          tooltip="Add Folder to Solution..."
        />
      )}
      {solution != null && solution.isExplicitSolution !== true && (
        <PaneHeaderIcon
          studio={bifrost}
          icon="ph-fill ph-tree-view"
          command="std.solution.convertFolderToSolution"
          tooltip="Convert to Solution..."
        />
      )}
      <PaneHeaderIcon studio={bifrost} icon="ph ph-arrows-clockwise" command="std.solution.refresh" tooltip="Refresh" />
      <PaneHeaderIcon
        studio={bifrost}
        icon="ph ph-arrows-in-line-vertical"
        command="std.fileExplorer.collapseAll"
        tooltip="Collapse All"
      />
    </>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost: Bifrost = Bifrost.cast(props.studio);

  const solution = bifrost.fileExplorerView.getViewData().solution;
  const decorationSource = useMemo(() => bifrost.fileExplorerView.getDecorationSource(), [bifrost]);
  const lastDropEvent = useRef<DragEvent | null>(null);

  useEffect(() => {
    const captureDropEvent = (event: DragEvent) => {
      lastDropEvent.current = event;
    };
    document.addEventListener('drop', captureDropEvent, true);
    return () => document.removeEventListener('drop', captureDropEvent, true);
  }, []);

  const solutionEntries = useMemo(() => {
    if (solution == null) {
      return null;
    }
    const shouldFlatten =
      solution.entries.length === 1 && solution.entries[0].type === 'project' && !solution.isExplicitSolution;

    const sortEntries = (entries: any[]) =>
      [...entries].sort((entryA: any, entryB: any): number => {
        if (entryA.type === entryB.type) {
          return entryA.label.localeCompare(entryB.label);
        }
        return entryA.type === 'directory' ? -1 : 1;
      });

    if (shouldFlatten) {
      const entries = solution.entries[0].entries;
      if (entries == null) {
        return null;
      }
      return sortEntries(entries);
    }

    return solution.entries.map((projectEntry: any) => ({
      ...projectEntry,
      entries: projectEntry.entries != null ? sortEntries(projectEntry.entries) : projectEntry.entries,
    }));
  }, [solution]);

  const projectRootUri = useMemo(() => {
    const currentSolution = bifrost.solution.getSolution();
    if (currentSolution == null) {
      return null;
    }
    if (currentSolution.projects.length === 1 && currentSolution.isExplicitSolution !== true) {
      return currentSolution.projects[0].baseUri;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bifrost.solution, solution]);

  const resolveSourceUris = useCallback(
    (draggedItem: any): string[] => {
      const treeViewMediator = bifrost.views.getById<TreeViewMediator>('std/file-explorer/open-solution');
      const selectedMetadata = treeViewMediator.getSelectedMetadata();
      const draggedUri = draggedItem.metadata?.uri;
      const isPartOfSelection = selectedMetadata.some((metadata: any) => metadata?.uri === draggedUri);
      return isPartOfSelection
        ? selectedMetadata
            .filter((metadata: any) => metadata?.type === 'file' || metadata?.type === 'directory')
            .map((metadata: any) => metadata?.uri)
            .filter(Boolean)
        : [draggedUri].filter(Boolean);
    },
    [bifrost],
  );

  const onClick = useCallback(
    (metadata: any): void => {
      if (metadata && metadata.openUriOnClick === true) {
        bifrost.commands.executeCommand('std.editor.focusOrOpenDocument', [metadata.uri]);
      }
    },
    [bifrost],
  );

  const onDoubleClick = useCallback(
    (metadata: any): void => {
      if (metadata && metadata.openUriOnClick === true) {
        bifrost.commands.executeCommand('std.editor.persistTemporaryTabIfExists', [metadata.uri]);
      }
    },
    [bifrost],
  );

  const buildDropContext = useCallback(
    () => ({ type: 'generic' as const, data: null, event: lastDropEvent.current }),
    [],
  );

  const executeDropCommand = useCallback(
    (sourceUris: string[], targetUri: string): void => {
      try {
        const result = bifrost.commands.executeCommand(
          'std.fileExplorer.dropItems',
          [sourceUris, targetUri],
          buildDropContext(),
        );
        Promise.resolve(result).catch((error) => console.warn('Drop command failed:', error));
      } catch (error) {
        console.warn('Drop command could not be executed:', error);
      }
    },
    [bifrost, buildDropContext],
  );

  const onDragAndDropItem = useCallback(
    (draggedItem: any, dropTarget: any): void => {
      const sourceUris = resolveSourceUris(draggedItem);
      const targetUri = dropTarget.metadata?.uri;
      if (!targetUri || sourceUris.length === 0) {
        return;
      }

      executeDropCommand(sourceUris, targetUri);
    },
    [resolveSourceUris, executeDropCommand],
  );

  const onExternalFileDrop = useCallback(
    (files: File[], dropTarget: any): void => {
      const targetUri = dropTarget.metadata?.uri;
      if (!targetUri || !bifrost.commands.isRegistered(GET_PATHS_COMMAND)) {
        return;
      }

      (async () => {
        const paths: string[] = bifrost.commands.executeCommand(GET_PATHS_COMMAND, [Array.from(files)]);
        if (paths.length === 0) {
          return;
        }
        await bifrost.commands.executeCommand('std.fileExplorer.handleExternalDropIntoSolution', [paths, targetUri]);
      })().catch((error) => console.warn('External file drop failed:', error));
    },
    [bifrost],
  );

  const [{ isOver: isOverRoot }, rootDrop] = useDrop(
    () => ({
      accept: ['tree_item', NATIVE_FILE_TYPE],
      drop: (draggedItem: any, monitor: any) => {
        if (monitor.didDrop()) {
          return;
        }
        if (projectRootUri == null) {
          return;
        }

        if (monitor.getItemType() === NATIVE_FILE_TYPE) {
          if (!bifrost.commands.isRegistered(GET_PATHS_COMMAND)) {
            return;
          }
          (async () => {
            const paths: string[] = bifrost.commands.executeCommand(GET_PATHS_COMMAND, [Array.from(draggedItem.files)]);
            if (paths.length === 0) {
              return;
            }
            await bifrost.commands.executeCommand('std.fileExplorer.handleExternalDropIntoSolution', [
              paths,
              projectRootUri,
            ]);
          })().catch((error) => console.warn('External root drop failed:', error));
          return;
        }

        const sourceUris = resolveSourceUris(draggedItem);
        if (sourceUris.length === 0) {
          return;
        }
        executeDropCommand(sourceUris, projectRootUri);
      },
      canDrop: (_item: any, monitor: any) => !monitor.didDrop() && projectRootUri != null,
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }) && monitor.canDrop(),
      }),
    }),
    [projectRootUri, resolveSourceUris, executeDropCommand, bifrost],
  );

  const connectScrollTarget = useScrollPositionManager('solutions-scroll', { precise: true });

  return (
    <>
      {solution == null ? (
        <SolutionExplorerEmptyState bifrost={props.studio} />
      ) : (
        <div
          ref={(node) => {
            rootDrop(node);
            connectScrollTarget(node!);
          }}
          className={`pane__content pane__content--treeview pane__content--scroll-vertically${isOverRoot ? ' pane__content--drop-target' : ''}`}
        >
          <Tree
            studio={props.studio}
            viewMediatorId="std/file-explorer/open-solution"
            entries={solutionEntries ?? []}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onDragAndDropItem={onDragAndDropItem}
            onExternalFileDrop={onExternalFileDrop}
            iconComponent={Icon}
            multiSelectionMenuId="std/file-explorer/multi-selection"
            decorationSource={decorationSource}
          />
        </div>
      )}
    </>
  );
}

function SolutionExplorerEmptyState(props: any): React.JSX.Element {
  const bifrost: Bifrost = props.bifrost;
  const clickHandler = bifrost.commands.getClickHandler();

  const [{ isOver }, emptyDrop] = useDrop(
    () => ({
      accept: NATIVE_FILE_TYPE,
      drop: (item: any) => {
        if (!bifrost.commands.isRegistered(GET_PATHS_COMMAND)) {
          return;
        }
        (async () => {
          const paths: string[] = bifrost.commands.executeCommand(GET_PATHS_COMMAND, [Array.from(item.files)]);
          if (paths.length === 0) {
            return;
          }
          await bifrost.commands.executeCommand('std.fileExplorer.handleExternalDrop', [paths]);
        })().catch((error) => console.warn('External drop on empty state failed:', error));
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [bifrost],
  );

  return (
    <div
      ref={emptyDrop as any}
      className={`pane__content text-center py-4${isOver ? ' pane__content--drop-target' : ''}`}
    >
      <p>Open a folder as a solution:</p>
      <p>
        <button onClick={clickHandler('std.editor.openFolderAsSolution')} className="btn btn-secondary">
          Open Folder
        </button>
      </p>
    </div>
  );
}
