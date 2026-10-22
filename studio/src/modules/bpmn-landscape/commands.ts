import type { Bifrost } from '#bifrost/Bifrost';

import type { AddProcessRequest } from './LandscapeMapDocumentModel';
import LandscapeMapDocumentModel from './LandscapeMapDocumentModel';
import { createEmptyLandscapeMap, serializeLandscapeMap } from './LandscapeMapFile';

const MAP_EXTENSION = '.bfwmap';
const DIRECTIONS = ['left', 'right', 'up', 'down'] as const;

function getFocusedMap(bifrost: Bifrost): LandscapeMapDocumentModel | null {
  const editorDocument = bifrost.editors.getFocusedEditorDocument();
  const model = editorDocument == null ? null : bifrost.editors.getEditorDocumentModelIfPresent(editorDocument);
  return model instanceof LandscapeMapDocumentModel ? model : null;
}

/** The focused map, unless a label is being edited: then the keys belong to the text box. */
function getFocusedMapForKeys(bifrost: Bifrost): LandscapeMapDocumentModel | null {
  const model = getFocusedMap(bifrost);
  return model == null || model.isDirectEditingActive() ? null : model;
}

function hasSelection(bifrost: Bifrost): boolean {
  return (
    getFocusedMapForKeys(bifrost) != null && bifrost.editors.getFocusedEditorDocument()?.metadata?.hasSelection === true
  );
}

async function newMap(bifrost: Bifrost): Promise<void> {
  const projectUri = bifrost.solution.getSolution()?.projects[0]?.baseUri;
  if (projectUri == null) {
    bifrost.notifications.open({
      type: 'info',
      content: 'Open a solution first; a landscape map is saved inside it.',
      source: 'Landscapes',
    });
    return;
  }
  const folderPath = bifrost.files.joinPaths(await bifrost.files.getLocalDirectory(projectUri), 'landscapes');
  const folderUri = bifrost.files.getUriForFilename(folderPath);
  const createsFolder = !(await bifrost.files.doesFileOrDirectoryExist(folderPath));
  if (createsFolder) {
    await bifrost.files.createDirectory(folderUri);
  }

  const chosenPath = await bifrost.dialog.showSaveFile({
    title: 'New Landscape Map',
    defaultPath: bifrost.files.joinPaths(folderPath, `New Landscape${MAP_EXTENSION}`),
    filters: [{ name: 'Landscape Map', extensions: ['bfwmap'] }],
  });
  if (chosenPath == null) {
    if (createsFolder) {
      await bifrost.files.deleteFilesAndDirectories([folderUri]);
    }
    return;
  }

  const path = chosenPath.endsWith(MAP_EXTENSION) ? chosenPath : `${chosenPath}${MAP_EXTENSION}`;
  const uri = bifrost.files.getUriForFilename(path);
  if (createsFolder && !uri.startsWith(`${folderUri}/`)) {
    await bifrost.files.deleteFilesAndDirectories([folderUri]);
  }
  // The save dialog only asked about overwriting the name without the extension.
  if (path !== chosenPath && (await bifrost.files.doesFileOrDirectoryExist(path))) {
    bifrost.notifications.open({
      type: 'warning',
      content: `${bifrost.files.getLocalBasename(uri)} already exists. Choose another name for the new map.`,
      source: 'Landscapes',
    });
    return;
  }
  const map = createEmptyLandscapeMap(bifrost.files.getLocalBasename(uri, true));
  await bifrost.editors.createNewEditorDocument(uri, serializeLandscapeMap(map));
  await bifrost.solution.onElementAdded(uri);
}

export function registerLandscapeCommands(bifrost: Bifrost): void {
  bifrost.commands.register('bpmn.landscape.newMap', () => newMap(bifrost), {
    visibleInSearch: true,
    description: ['Landscapes: New Map', 'Create a new landscape map'],
  });

  bifrost.commands.register(
    'bpmn.landscape.addProcessToMap',
    (request: AddProcessRequest) => getFocusedMap(bifrost)?.addProcess(request),
    { enabledWhen: () => getFocusedMap(bifrost) != null },
  );

  bifrost.commands.register('bpmn.landscape.deleteSelection', () => getFocusedMapForKeys(bifrost)?.deleteSelection(), {
    enabledWhen: () => hasSelection(bifrost),
  });

  bifrost.commands.register('bpmn.landscape.copySelection', () => getFocusedMapForKeys(bifrost)?.copySelection(), {
    enabledWhen: () => hasSelection(bifrost),
  });

  bifrost.commands.register('bpmn.landscape.paste', () => getFocusedMapForKeys(bifrost)?.paste(), {
    enabledWhen: () => getFocusedMapForKeys(bifrost)?.hasClipboardContent() === true,
  });

  bifrost.commands.register('bpmn.landscape.toggleFocusMode', () => getFocusedMapForKeys(bifrost)?.toggleFocusMode(), {
    visibleInSearch: true,
    description: ['Landscapes: Toggle Focus Mode', 'Dim everything that is not related to the selection'],
    enabledWhen: () => getFocusedMapForKeys(bifrost)?.getMapProperties() != null,
  });

  for (const direction of DIRECTIONS) {
    const name = `${direction[0].toUpperCase()}${direction.slice(1)}`;
    for (const accelerated of [false, true]) {
      bifrost.commands.register(
        `bpmn.landscape.moveSelection${name}${accelerated ? 'Accelerated' : ''}`,
        () => getFocusedMapForKeys(bifrost)?.moveSelection(direction, accelerated),
        { enabledWhen: () => hasSelection(bifrost) },
      );
    }
  }
}
