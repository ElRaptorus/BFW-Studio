import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogResult, DialogValidationResult } from '#bifrost/contracts/DialogTypes';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';

import type { AddMapLinkRequest, AddProcessRequest } from './LandscapeMapDocumentModel';
import LandscapeMapDocumentModel from './LandscapeMapDocumentModel';
import type { LandscapeMap } from './LandscapeMapFile';
import { createEmptyLandscapeMap, serializeLandscapeMap } from './LandscapeMapFile';
import type { LandscapeSolutionScan } from './LandscapeSolutionScan';
import { LANDSCAPE_SOLUTION_SCAN_KEY } from './LandscapeSolutionScan';
import type { LandscapeProcessReference } from './buildProcessRelations';
import type { NewMapGrouping } from './createLandscapeMap';
import { createLandscapeMap } from './createLandscapeMap';
import { registerLandscapeExportCommands } from './exportCommands';
import { linkPlaceholderToProcess, modelPlaceholderAsProcess } from './fillPlaceholder';
import type { LandscapeGate } from './landscapeFolder';
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

type ReadyLandscapeGate = Extract<LandscapeGate, { state: 'ready' }>;

/** The gate when maps can be saved; otherwise the user is told what is missing and the result is `null`. */
function getReadyGateOrExplain(bifrost: Bifrost): ReadyLandscapeGate | null {
  const gate = getLandscapeGate(bifrost);
  if (gate.state === 'ready') {
    return gate;
  }
  bifrost.categories.activatePage(LANDSCAPES_PAGE_ID);
  showLandscapeNotification(
    bifrost,
    'info',
    'Landscape maps are saved in the landscape folder of a saved solution. Set it up in the Maps explorer first.',
  );
  return null;
}

/** Asks where to save a new map; `null` when the user cancelled or was told why the place does not work. */
async function askForNewMapUri(bifrost: Bifrost, defaultName: string, directoryUri?: string): Promise<string | null> {
  const gate = getReadyGateOrExplain(bifrost);
  if (gate == null) {
    return null;
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
      `${defaultName}${MAP_EXTENSION}`,
    ),
    filters: [{ name: 'Landscape Map', extensions: ['bfwmap'] }],
  });
  if (chosenPath == null) {
    return null;
  }

  const path = chosenPath.endsWith(MAP_EXTENSION) ? chosenPath : `${chosenPath}${MAP_EXTENSION}`;
  const uri = bifrost.files.getUriForFilename(path);
  if (!isInLandscapeFolder(uri, folderUri)) {
    showLandscapeNotification(
      bifrost,
      'warning',
      `Landscape maps are saved in the landscape folder ${describeLandscapeFolder(bifrost, solutionFileUri, folderUri)}. Choose a place inside it.`,
    );
    return null;
  }
  // The save dialog only asked about overwriting the name without the extension.
  if (path !== chosenPath && (await bifrost.files.doesFileOrDirectoryExist(path))) {
    showLandscapeNotification(
      bifrost,
      'warning',
      `${bifrost.files.getLocalBasename(uri)} already exists. Choose another name for the new map.`,
    );
    return null;
  }
  return uri;
}

async function newMap(bifrost: Bifrost, directoryUri?: string): Promise<void> {
  const uri = await askForNewMapUri(bifrost, 'New Landscape', directoryUri);
  if (uri == null) {
    return;
  }
  const map = createEmptyLandscapeMap(bifrost.files.getLocalBasename(uri, true));
  await bifrost.editors.createNewEditorDocument(uri, serializeLandscapeMap(map));
  await bifrost.solution.onElementAdded(uri);
}

/** A row of the Processes pane: a process, or a whole file when no process id is given. */
type ProcessSeedRow = { fileUri: string; processId?: string | null };

const NEIGHBOUR_STEP_ENTRIES = [0, 1, 2, 3].map((steps) => ({
  label: steps === 0 ? 'None' : `${steps} ${steps === 1 ? 'step' : 'steps'}`,
  value: String(steps),
}));

const GROUPING_ENTRIES: { label: string; value: NewMapGrouping }[] = [
  { label: 'None', value: 'none' },
  { label: 'By folder', value: 'folder' },
  { label: 'By file', value: 'file' },
];

/** The processes the rows stand for, each once; without rows, every process of the solution. */
function collectSeeds(catalog: SolutionBpmnModelEntry[], rows?: ProcessSeedRow[]): LandscapeProcessReference[] {
  const seeds = new Map<string, LandscapeProcessReference>();
  for (const entry of catalog) {
    if (entry.kind !== 'bpmn') {
      continue;
    }
    for (const process of entry.processes) {
      const isWanted =
        rows == null || rows.some((row) => row.fileUri === entry.uri && (row.processId ?? process.id) === process.id);
      if (isWanted) {
        seeds.set(`${entry.uri}#${process.id}`, { uri: entry.uri, processId: process.id });
      }
    }
  }
  return [...seeds.values()];
}

async function createMapFromProcesses(bifrost: Bifrost, rows?: ProcessSeedRow[]): Promise<void> {
  if (getReadyGateOrExplain(bifrost) == null) {
    return;
  }
  const solutionScan = bifrost.getSharedRessource<LandscapeSolutionScan>(LANDSCAPE_SOLUTION_SCAN_KEY);
  if (solutionScan.getSnapshot() == null) {
    await solutionScan.refresh();
  }
  const snapshot = solutionScan.getSnapshot();
  const seeds = snapshot == null ? [] : collectSeeds(snapshot.catalog, rows);
  if (snapshot == null || seeds.length === 0) {
    showLandscapeNotification(bifrost, 'info', 'There are no processes to put on a map.');
    return;
  }

  const singleProcess =
    seeds.length === 1
      ? snapshot.catalog
          .flatMap((entry) => (entry.kind === 'bpmn' && entry.uri === seeds[0]?.uri ? entry.processes : []))
          .find((process) => process.id === seeds[0]?.processId)
      : undefined;
  const dialogResult = await bifrost.dialog.open(
    {
      title: 'Create Landscape Map from Processes',
      content: [
        { type: 'text', text: `${seeds.length} ${seeds.length === 1 ? 'process' : 'processes'} selected.` },
        {
          type: 'text_input',
          id: 'name',
          label: 'Name',
          value: singleProcess == null ? 'New Landscape' : singleProcess.name || singleProcess.id,
          focus: true,
        },
        {
          type: 'select',
          id: 'neighbourSteps',
          label: 'Add related processes',
          value: rows == null ? '0' : '1',
          entries: NEIGHBOUR_STEP_ENTRIES,
          hint: 'Processes linked to the selection by a call, message or signal, in either direction, within this many steps.',
        },
        { type: 'select', id: 'grouping', label: 'Group processes', value: 'file', entries: GROUPING_ENTRIES },
        { type: 'checkbox', id: 'callHierarchy', label: 'Arrange by call hierarchy', checked: true },
      ],
      actions: [
        { label: 'Cancel', response: 'cancel', cancel: true },
        { label: 'Create', response: 'create', default: true },
      ],
    },
    async (result: DialogResult): Promise<DialogValidationResult> => {
      if (result.response === 'create' && String(result.formData?.name ?? '').trim() === '') {
        return { closeDialog: false, validationErrors: [{ contentId: 'name', errorLabel: 'Name cannot be empty' }] };
      }
      return { closeDialog: true };
    },
  );
  if (dialogResult.wasCancelled || dialogResult.response !== 'create') {
    return;
  }
  const name = String(dialogResult.formData?.name).trim();

  const uri = await askForNewMapUri(bifrost, name);
  if (uri == null) {
    return;
  }
  let map: LandscapeMap;
  try {
    map = await createLandscapeMap({
      catalog: snapshot.catalog,
      relations: snapshot.relations,
      seeds,
      neighbourSteps: Number(dialogResult.formData?.neighbourSteps),
      grouping: dialogResult.formData?.grouping,
      callHierarchy: dialogResult.formData?.callHierarchy === true,
      name,
      mapUri: uri,
    });
  } catch (error) {
    bifrost.notifications.open({
      type: 'error',
      content: `The map could not be arranged: ${error instanceof Error ? error.message : String(error)}`,
      source: 'Landscapes',
    });
    return;
  }
  await bifrost.editors.createNewEditorDocument(uri, serializeLandscapeMap(map));
  await bifrost.solution.onElementAdded(uri);
}

/**
 * Creates and declares `givenFolderUri`, else the declared landscape folder, else `landscapes/` next to the solution
 * file. Returns the folder, or `null` without a saved solution or when the solution file could not be written.
 */
async function setUpLandscapeFolder(bifrost: Bifrost, givenFolderUri?: string): Promise<string | null> {
  const gate = getLandscapeGate(bifrost);
  if (gate.state !== 'no-folder' && gate.state !== 'ready') {
    return null;
  }
  const folderUri =
    givenFolderUri ??
    (gate.state === 'ready'
      ? gate.folderUri
      : `${getSolutionDirectoryUri(gate.solutionFileUri)}/${DEFAULT_FOLDER_NAME}`);
  if (!(await bifrost.files.doesFileOrDirectoryExist(bifrost.files.getLocalFilenameForUri(folderUri)))) {
    await bifrost.files.createDirectory(folderUri);
  }
  return (await bifrost.solution.setViewFolder(LANDSCAPES_VIEW_ID, folderUri)) ? folderUri : null;
}

/** Sets up the landscape folder of a solution the wizard just saved and opens a map named after the solution. */
async function setUpNewSolution(bifrost: Bifrost, folderUri?: string): Promise<void> {
  const landscapeFolderUri = await setUpLandscapeFolder(bifrost, folderUri);
  const solutionFileUri = bifrost.solution.getSolution()?.solutionFileUri;
  if (landscapeFolderUri == null || solutionFileUri == null) {
    return;
  }
  const name = bifrost.files.getLocalBasename(solutionFileUri, true);
  const mapUri = `${landscapeFolderUri}/${name}${MAP_EXTENSION}`;
  if (await bifrost.files.doesFileOrDirectoryExist(bifrost.files.getLocalFilenameForUri(mapUri))) {
    bifrost.editors.focusOrOpenEditorDocument(mapUri);
    return;
  }
  await bifrost.editors.createNewEditorDocument(mapUri, serializeLandscapeMap(createEmptyLandscapeMap(name)));
  await bifrost.solution.onElementAdded(mapUri);
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

  bifrost.commands.register(
    'bpmn.landscape.createMapFromProcesses',
    (rows?: ProcessSeedRow[]) => createMapFromProcesses(bifrost, rows),
    {
      visibleInSearch: true,
      description: [
        'Landscapes: Create Map from Processes...',
        'Create a landscape map from the processes of the solution, arranged automatically',
      ],
    },
  );

  bifrost.commands.register('bpmn.landscape.setUpLandscapeFolder', () => setUpLandscapeFolder(bifrost), {
    visibleInSearch: true,
    description: [
      'Landscapes: Set Up Landscape Folder',
      'Create the landscape folder of the solution, next to the solution file unless another one is declared',
    ],
    enabledWhen: () => hasSavedSolution(bifrost),
  });

  bifrost.commands.register(
    'bpmn.landscape.setUpNewSolution',
    (folderUri?: string) => setUpNewSolution(bifrost, folderUri),
    { enabledWhen: () => hasSavedSolution(bifrost) },
  );

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

  /** The placeholder a command acts on: the given element, else the only selected one. */
  const getPlaceholderTarget = (
    elementId?: string,
  ): { model: LandscapeMapDocumentModel; placeholderId: string } | null => {
    const model = getFocusedMap(bifrost);
    const selected = model?.getSelectedElements() ?? [];
    const placeholderId = elementId ?? (selected.length === 1 ? selected[0].id : null);
    return model != null && placeholderId != null && model.getPlaceholder(placeholderId) != null
      ? { model, placeholderId }
      : null;
  };

  bifrost.commands.register(
    'bpmn.landscape.modelPlaceholder',
    async (elementId?: string) => {
      const target = getPlaceholderTarget(elementId);
      const gate = target == null ? null : getReadyGateOrExplain(bifrost);
      if (target != null && gate != null) {
        await modelPlaceholderAsProcess(bifrost, target.model, target.placeholderId, gate);
      }
    },
    {
      visibleInSearch: true,
      description: ['Landscapes: Model this Process...', 'Create a BPMN process for the selected placeholder'],
      enabledWhen: (elementId?: string) => getPlaceholderTarget(elementId) != null,
    },
  );

  bifrost.commands.register(
    'bpmn.landscape.linkPlaceholder',
    async (elementId?: string) => {
      const target = getPlaceholderTarget(elementId);
      if (target != null) {
        await linkPlaceholderToProcess(bifrost, target.model, target.placeholderId);
      }
    },
    {
      visibleInSearch: true,
      description: ['Landscapes: Link to Existing Process...', 'Link the selected placeholder to a process'],
      enabledWhen: (elementId?: string) => {
        const target = getPlaceholderTarget(elementId);
        return target != null && target.model.getFreeProcessCandidates().length > 0;
      },
    },
  );

  bifrost.commands.register(
    'bpmn.landscape.addMapLinkToMap',
    (request: AddMapLinkRequest) => getFocusedMap(bifrost)?.addMapLink(request),
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

  bifrost.commands.register(
    'bpmn.landscape.openSelectedElement',
    (elementId: string) => getFocusedMap(bifrost)?.openElement(elementId),
    { enabledWhen: () => getFocusedMap(bifrost) != null },
  );

  bifrost.commands.register(
    'bpmn.landscape.changeElementType',
    (elementId: string) => getFocusedMap(bifrost)?.openChangeTypeMenu(elementId),
    { enabledWhen: () => getFocusedMap(bifrost) != null },
  );

  bifrost.commands.register(
    'bpmn.landscape.openElementInTextEditor',
    (editorDocument: EditorDocument, elementId: string) => {
      const textBeforeElement = editorDocument.data.original.split(` id="${elementId}"`)[0];
      const lines = textBeforeElement.split('\n');
      // Without a match (an element not saved yet) the whole file is the text before it: open at the top instead.
      const isOnFile = textBeforeElement !== editorDocument.data.original;
      void bifrost.commands.executeCommand(
        'std.shell.openDocumentInTextEditor',
        isOnFile ? [editorDocument, lines.length, lines[lines.length - 1].length + 2] : [editorDocument],
      );
    },
    {
      enabledWhen: (editorDocument: EditorDocument): boolean =>
        bifrost.commands.isCommandEnabled('std.shell.openDocumentInTextEditor', [editorDocument]),
    },
  );

  bifrost.commands.register(
    'bpmn.landscape.toggleShowGrid',
    () => {
      void bifrost.settings.set('bpmn.landscape.showGrid', bifrost.settings.get('bpmn.landscape.showGrid') === false);
    },
    {
      visibleInSearch: true,
      description: ['Landscapes: Toggle Show Grid', 'Show or hide the grid of the landscape map canvas'],
    },
  );

  registerLandscapeExportCommands(bifrost);

  // `std.editor.zoomTo…` (menu, Ctrl+1/2/3, toolbar) dispatches to these by document type.
  const zoomActions = {
    zoomToViewport: (model: LandscapeMapDocumentModel) => model.zoomToViewport(),
    zoomToActualSize: (model: LandscapeMapDocumentModel) => model.zoomToActualSize(),
    zoomToSelectedElement: (model: LandscapeMapDocumentModel) => model.zoomToSelectedElement(),
  };
  for (const [name, zoom] of Object.entries(zoomActions)) {
    bifrost.commands.register(`std.editor.${name}.bpmn-landscape-map`, async (editorDocument: EditorDocument) =>
      zoom(await bifrost.editors.getEditorDocumentModel<LandscapeMapDocumentModel>(editorDocument)),
    );
  }

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
