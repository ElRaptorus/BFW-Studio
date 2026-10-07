import type { TreeItem } from '#bifrost/contracts/TreeTypes';

import type { SolutionModelEntry } from './scanSolutionModels';

export type DeployExplorerMode = 'file' | 'project';

export type DeployExplorerMetadata =
  { kind: 'folder'; uri: string; modelUris: string[] } | { kind: 'file'; uri: string; modelUris: string[] };

export type DeployExplorerRoot = { name: string; uri: string };

const BPMN_ICON = 'bpmn/editor-tab/bpmn';
const DMN_ICON = 'dmn/editor-tab/dmn';
const FOLDER_ICON = 'std/tree/folder-{closed:open}';
const PROJECT_ICON = 'std/tree/project-{closed:open}';

type FolderNode = { name: string; pathId: string; folders: Map<string, FolderNode>; files: SolutionModelEntry[] };

function createFolder(name: string, pathId: string): FolderNode {
  return { name, pathId, folders: new Map(), files: [] };
}

function collectModelUris(folder: FolderNode): string[] {
  return [...folder.files.map((file) => file.uri), ...[...folder.folders.values()].flatMap(collectModelUris)];
}

function toTreeItem(folder: FolderNode, mode: DeployExplorerMode, isProject = false): TreeItem {
  const modelUris = collectModelUris(folder);
  const folderItems = [...folder.folders.values()]
    .sort((first, second) => first.name.localeCompare(second.name))
    .map((child) => toTreeItem(child, mode));
  const fileItems =
    mode === 'file'
      ? folder.files
          .slice()
          .sort((first, second) => first.uri.localeCompare(second.uri))
          .map((file): TreeItem => ({
            type: 'file',
            pathId: file.uri,
            label: file.uri.split('/').pop() ?? file.uri,
            labelIcon: file.kind === 'dmn' ? DMN_ICON : BPMN_ICON,
            metadata: { kind: 'file', uri: file.uri, modelUris: [file.uri] } satisfies DeployExplorerMetadata,
            menuId: 'engine/deploy-explorer/item',
            badges: file.kind === 'invalid' ? [{ type: 'character', character: '!' }] : undefined,
            labelTooltip: file.kind === 'invalid' ? file.error : undefined,
          }))
      : [];
  return {
    type: 'directory',
    pathId: folder.pathId,
    label: folder.name,
    labelIcon: isProject ? PROJECT_ICON : FOLDER_ICON,
    metadata: { kind: 'folder', uri: folder.pathId, modelUris } satisfies DeployExplorerMetadata,
    menuId: 'engine/deploy-explorer/item',
    entries: [...folderItems, ...fileItems],
    expanded: true,
    badges: [{ type: 'number', number: modelUris.length }],
  };
}

/**
 * Builds the Deploy Explorer tree from the scanned model files. Folders are derived from the file paths relative to the
 * project root. File mode shows the model files, Project mode only the folders (with a model count). A single project
 * is flattened to its content.
 */
export function buildDeployExplorerTree(
  entries: SolutionModelEntry[],
  roots: DeployExplorerRoot[],
  mode: DeployExplorerMode,
): TreeItem[] {
  const projects = roots.map((root) => {
    const rootPath = root.uri.replace(/^file:\/\//, '').replace(/\/$/, '');
    const project = createFolder(root.name, root.uri);
    for (const entry of entries) {
      const entryPath = entry.uri.replace(/^file:\/\//, '');
      if (!entryPath.startsWith(`${rootPath}/`)) {
        continue;
      }
      const segments = entryPath.slice(rootPath.length + 1).split('/');
      let folder = project;
      let pathId = root.uri;
      for (const segment of segments.slice(0, -1)) {
        pathId = `${pathId}/${segment}`;
        if (!folder.folders.has(segment)) {
          folder.folders.set(segment, createFolder(segment, pathId));
        }
        folder = folder.folders.get(segment) as FolderNode;
      }
      folder.files.push(entry);
    }
    return project;
  });

  const items = projects.map((project) => toTreeItem(project, mode, true));
  return items.length === 1 ? (items[0].entries ?? []) : items;
}
