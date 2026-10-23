import { Bifrost } from '#bifrost/Bifrost';
import type { TreeViewMediator } from '#bifrost/browser/TreeViewMediator';
import { DESIGNER_EXPLORER_ID, type ExplorerDefinition, getExplorerTreeId } from '#bifrost/contracts/ExplorerTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { DRAG_TYPE_FILES, useDropTarget } from '#components/DragAndDrop';
import { useScrollPositionManager } from '#components/ScrollPositionManager';
import { Tree } from '#components/Tree/Tree';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderIcon } from '#components/panes/PaneHeaderIcon';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { Icon } from '../../../Icon';

const GET_PATHS_COMMAND = 'std.internal.getPathsFromFiles';

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Explorer',
  Pane: PaneFull,
  PaneContent: PaneContent,
  classNames: 'app-layout__solution-pane',
};

function getDefinition(bifrost: Bifrost, paneId: string): ExplorerDefinition {
  return bifrost.explorers.getByPaneId(paneId) ?? bifrost.explorers.get(DESIGNER_EXPLORER_ID);
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  const bifrost: Bifrost = Bifrost.cast(props.studio);
  const definition = getDefinition(bifrost, props.paneId);
  const solution = bifrost.explorers.getView(definition.id).getViewData().solution;

  return (
    <Pane classNames="app-layout__full-height-pane">
      <PaneHeader
        studio={props.studio}
        title={definition.label ?? solution?.label ?? 'Explorer'}
        className="pane-header--hero"
        paneId={props.paneId}
        collapsed={props.collapsed}
      >
        {props.collapsed !== true && <PaneTabOptions bifrost={bifrost} definition={definition} />}
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneTabOptions(props: { bifrost: Bifrost; definition: ExplorerDefinition }): React.JSX.Element {
  const { bifrost, definition } = props;
  const solution = bifrost.solution.getSolution();
  const structural = definition.structuralOperations === true;

  return (
    <>
      {structural && (
        <>
          <PaneHeaderIcon
            studio={bifrost}
            icon="ph ph-file-plus"
            command="std.solution.newFile"
            tooltip="New file..."
          />
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
        </>
      )}
      <PaneHeaderIcon studio={bifrost} icon="ph ph-arrows-clockwise" command="std.solution.refresh" tooltip="Refresh" />
      <PaneHeaderIcon
        studio={bifrost}
        icon="ph ph-arrows-in-line-vertical"
        command="std.fileExplorer.collapseAll"
        commandArgs={[definition.id]}
        tooltip="Collapse All"
      />
      {definition.headerActions?.map((action) => (
        <PaneHeaderIcon
          key={action.command}
          studio={bifrost}
          icon={action.icon}
          command={action.command}
          commandArgs={action.commandArgs ? [...action.commandArgs] : undefined}
          tooltip={action.tooltip}
          dataTestId={action.dataTestId}
        />
      ))}
    </>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost: Bifrost = Bifrost.cast(props.studio);
  const definition = getDefinition(bifrost, props.paneId);
  const view = bifrost.explorers.getView(definition.id);
  const treeId = getExplorerTreeId(definition.id);
  const structural = definition.structuralOperations === true;

  const solution = view.getViewData().solution;
  const viewHasFiles = view.hasFiles();
  const decorationSource = useMemo(
    () => bifrost.explorers.getDecorationSource(definition.id),
    [bifrost, definition.id],
  );
  const lastDropEventRef = useRef<DragEvent | null>(null);

  useEffect(() => {
    const captureDropEvent = (event: DragEvent) => {
      lastDropEventRef.current = event;
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

  const rootUri = useMemo((): string | null => {
    if (solution == null || solution.isExplicitSolution || solution.entries.length !== 1) {
      return null;
    }
    const root = solution.entries[0];
    return root.type === 'project' ? root.uri : null;
  }, [solution]);

  const resolveSourceUris = useCallback(
    (draggedItem: any): string[] => {
      const treeViewMediator = bifrost.views.getById<TreeViewMediator>(treeId);
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
    [bifrost, treeId],
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
    () => ({ type: 'generic' as const, data: null, event: lastDropEventRef.current }),
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

  const { isOver: isOverRoot, dropTargetProps: rootDropProps } = useDropTarget({
    accept: ['tree_item', DRAG_TYPE_FILES],
    canDrop: () => structural && rootUri != null,
    onDrop: (subject) => {
      if (!structural || rootUri == null) {
        return;
      }

      if (subject.type === DRAG_TYPE_FILES) {
        if (!bifrost.commands.isRegistered(GET_PATHS_COMMAND)) {
          return;
        }
        (async () => {
          const paths: string[] = bifrost.commands.executeCommand(GET_PATHS_COMMAND, [subject.files]);
          if (paths.length === 0) {
            return;
          }
          await bifrost.commands.executeCommand('std.fileExplorer.handleExternalDropIntoSolution', [paths, rootUri]);
        })().catch((error) => console.warn('External root drop failed:', error));
        return;
      }

      const sourceUris = resolveSourceUris(subject.item);
      if (sourceUris.length === 0) {
        return;
      }
      executeDropCommand(sourceUris, rootUri);
    },
  });

  const connectScrollTarget = useScrollPositionManager(`explorer-scroll-${definition.id}`, { precise: true });

  const isLoading = solution?.entries[0]?.type === 'loading-indicator';
  const EmptyState = definition.emptyState;
  if (EmptyState != null && !isLoading && !viewHasFiles) {
    return <EmptyState studio={bifrost} />;
  }
  if (solution == null) {
    return <SolutionExplorerEmptyState bifrost={bifrost} />;
  }

  return (
    <div
      {...(structural ? rootDropProps : {})}
      ref={connectScrollTarget}
      className={`pane__content pane__content--treeview pane__content--scroll-vertically${isOverRoot ? ' pane__content--drop-target' : ''}`}
    >
      <Tree
        studio={props.studio}
        viewMediatorId={treeId}
        entries={solutionEntries ?? []}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onDragAndDropItem={structural ? onDragAndDropItem : undefined}
        draggable
        onExternalFileDrop={structural ? onExternalFileDrop : undefined}
        iconComponent={Icon}
        className="kbm-file-explorer"
        multiSelectionMenuId="std/file-explorer/multi-selection"
        decorationSource={decorationSource}
      />
    </div>
  );
}

function SolutionExplorerEmptyState(props: { bifrost: Bifrost }): React.JSX.Element {
  const bifrost = props.bifrost;
  const clickHandler = bifrost.commands.getClickHandler();

  const { isOver, dropTargetProps } = useDropTarget({
    accept: [DRAG_TYPE_FILES],
    onDrop: ({ files }) => {
      if (!bifrost.commands.isRegistered(GET_PATHS_COMMAND)) {
        return;
      }
      (async () => {
        const paths: string[] = bifrost.commands.executeCommand(GET_PATHS_COMMAND, [files]);
        if (paths.length === 0) {
          return;
        }
        await bifrost.commands.executeCommand('std.fileExplorer.handleExternalDrop', [paths]);
      })().catch((error) => console.warn('External drop on empty state failed:', error));
    },
  });

  return (
    <div
      {...dropTargetProps}
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
