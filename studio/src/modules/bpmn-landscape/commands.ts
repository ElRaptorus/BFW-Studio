import type { Bifrost } from '#bifrost/Bifrost';

import type { AddProcessRequest } from './LandscapeMapDocumentModel';
import LandscapeMapDocumentModel from './LandscapeMapDocumentModel';
import { createEmptyLandscapeMap, serializeLandscapeMap } from './LandscapeMapFile';
import {
  describeLandscapeFolder,
  getLandscapeGate,
  isInLandscapeFolder,
  LANDSCAPES_PAGE_ID,
  LANDSCAPES_VIEW_ID,
} from './landscapeFolder';

const MAP_EXTENSION = '.bfwmap';
const DEFAULT_FOLDER_NAME = 'landscapes';
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

function showLandscapeNotification(bifrost: Bifrost, type: 'info' | 'warning', content: string): void {
  bifrost.notifications.open({ type, content, source: 'Landscapes' });
}

async function newMap(bifrost: Bifrost, directoryUri?: string): Promise<void> {
  const gate = getLandscapeGate(bifrost);
  if (gate.state !== 'ready') {
    bifrost.categories.activatePage(LANDSCAPES_PAGE_ID);
    showLandscapeNotification(
      bifrost,
      'info',
      'Landscape maps are saved in the landscape folder of a saved solution. Set it up in the Maps explorer first.',
    );
    return;
  }
  const { folderUri, solutionFileUri } = gate;
  const folderPath = bifrost.files.getLocalFilenameForUri(folderUri);
  if (!(await bifrost.files.doesFileOrDirectoryExist(folderPath))) {
    await bifrost.files.createDirectory(folderUri);
    await bifrost.solution.onElementAdded(folderUri);
  }
  const targetUri = directoryUri != null && isInLandscapeFolder(directoryUri, folderUri) ? directoryUri : folderUri;

  const chosenPath = await bifrost.dialog.showSaveFile({
    title: 'New Landscape Map',
    defaultPath: bifrost.files.joinPaths(
      bifrost.files.getLocalFilenameForUri(targetUri),
      `New Landscape${MAP_EXTENSION}`,
    ),
    filters: [{ name: 'Landscape Map', extensions: ['bfwmap'] }],
  });
  if (chosenPath == null) {
    return;
  }

  const path = chosenPath.endsWith(MAP_EXTENSION) ? chosenPath : `${chosenPath}${MAP_EXTENSION}`;
  const uri = bifrost.files.getUriForFilename(path);
  if (!isInLandscapeFolder(uri, folderUri)) {
    showLandscapeNotification(
      bifrost,
      'warning',
      `Landscape maps are saved in the landscape folder ${describeLandscapeFolder(bifrost, solutionFileUri, folderUri)}. Choose a place inside it.`,
    );
    return;
  }
  // The save dialog only asked about overwriting the name without the extension.
  if (path !== chosenPath && (await bifrost.files.doesFileOrDirectoryExist(path))) {
    showLandscapeNotification(
      bifrost,
      'warning',
      `${bifrost.files.getLocalBasename(uri)} already exists. Choose another name for the new map.`,
    );
    return;
  }
  const map = createEmptyLandscapeMap(bifrost.files.getLocalBasename(uri, true));
  await bifrost.editors.createNewEditorDocument(uri, serializeLandscapeMap(map));
  await bifrost.solution.onElementAdded(uri);
}

/** Creates the declared landscape folder, or `landscapes/` next to the solution file when none is declared yet. */
async function setUpLandscapeFolder(bifrost: Bifrost): Promise<void> {
  const gate = getLandscapeGate(bifrost);
  if (gate.state !== 'no-folder' && gate.state !== 'ready') {
    return;
  }
  const folderUri =
    gate.state === 'ready' ? gate.folderUri : `${getSolutionDirectoryUri(gate.solutionFileUri)}/${DEFAULT_FOLDER_NAME}`;
  if (!(await bifrost.files.doesFileOrDirectoryExist(bifrost.files.getLocalFilenameForUri(folderUri)))) {
    await bifrost.files.createDirectory(folderUri);
  }
  await bifrost.solution.setViewFolder(LANDSCAPES_VIEW_ID, folderUri);
}

/** Declares another folder as the landscape folder. Maps in the previous folder stay where they are. */
async function chooseLandscapeFolder(bifrost: Bifrost): Promise<void> {
  const gate = getLandscapeGate(bifrost);
  if (gate.state !== 'no-folder' && gate.state !== 'ready') {
    return;
  }
  const directories = await bifrost.dialog.showOpenDirectory({
    defaultPath: bifrost.files.getLocalFilenameForUri(
      gate.state === 'ready' ? gate.folderUri : getSolutionDirectoryUri(gate.solutionFileUri),
    ),
  });
  const directory = directories?.[0];
  if (directory == null) {
    return;
  }
  const folderUri = bifrost.files.getUriForFilename(directory);
  if (bifrost.solution.getSolution()?.projects.some((project) => isInLandscapeFolder(project.baseUri, folderUri))) {
    showLandscapeNotification(
      bifrost,
      'warning',
      `${directory} holds a root folder of the solution. The landscape folder is read-only in the Designer, so choose a folder inside the solution or next to the solution file.`,
    );
    return;
  }
  await bifrost.solution.setViewFolder(LANDSCAPES_VIEW_ID, folderUri);
}

function getSolutionDirectoryUri(solutionFileUri: string): string {
  return solutionFileUri.slice(0, solutionFileUri.lastIndexOf('/'));
}

function hasSavedSolution(bifrost: Bifrost): boolean {
  const state = getLandscapeGate(bifrost).state;
  return state === 'no-folder' || state === 'ready';
}

export function registerLandscapeCommands(bifrost: Bifrost): void {
  bifrost.commands.register('bpmn.landscape.newMap', (directoryUri?: string) => newMap(bifrost, directoryUri), {
    visibleInSearch: true,
    description: ['Landscapes: New Map', 'Create a new landscape map'],
  });

  bifrost.commands.register('bpmn.landscape.setUpLandscapeFolder', () => setUpLandscapeFolder(bifrost), {
    visibleInSearch: true,
    description: [
      'Landscapes: Set Up Landscape Folder',
      'Create the landscape folder of the solution, next to the solution file unless another one is declared',
    ],
    enabledWhen: () => hasSavedSolution(bifrost),
  });

  bifrost.commands.register('bpmn.landscape.chooseLandscapeFolder', () => chooseLandscapeFolder(bifrost), {
    visibleInSearch: true,
    description: [
      'Landscapes: Choose Landscape Folder',
      'Choose the folder that holds the landscape maps of the solution',
    ],
    enabledWhen: () => hasSavedSolution(bifrost),
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
