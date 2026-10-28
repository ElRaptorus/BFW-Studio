import type { Bifrost } from '#bifrost/Bifrost';
import type { DialogResult, DialogValidationError, DialogValidationResult } from '#bifrost/contracts/DialogTypes';
import { parseSolutionBpmnModel } from '#modules/bpmn-core/parseSolutionBpmnModel';

import type LandscapeMapDocumentModel from './LandscapeMapDocumentModel';
import type { LandscapeSolutionScan, LandscapeSolutionSnapshot } from './LandscapeSolutionScan';
import { LANDSCAPE_SOLUTION_SCAN_KEY } from './LandscapeSolutionScan';
import type { LandscapeGate } from './landscapeFolder';
import { isInLandscapeFolder } from './landscapeFolder';
import type { ProcessCandidate } from './resolveProcessReference';

type ReadyLandscapeGate = Extract<LandscapeGate, { state: 'ready' }>;

const NEW_FOLDER_NAME = 'processes';
const SCAN_WAIT_MILLISECONDS = 10_000;
const FORBIDDEN_NAME_CHARACTERS = /[\\/:*?"<>|]/;

function notify(bifrost: Bifrost, type: 'info' | 'warning' | 'error', content: string): void {
  bifrost.notifications.open({ type, content, source: 'Landscapes' });
}

/** Links a placeholder to a process of the solution that is not on the map yet. */
export async function linkPlaceholderToProcess(
  bifrost: Bifrost,
  model: LandscapeMapDocumentModel,
  placeholderId: string,
): Promise<void> {
  const placeholder = model.getPlaceholder(placeholderId);
  if (placeholder == null) {
    return;
  }
  const candidates: ProcessCandidate[] = model.getFreeProcessCandidates();
  if (candidates.length === 0) {
    notify(bifrost, 'info', 'Every process of the solution is already on this map.');
    return;
  }
  const entries = candidates.map((candidate, index) => {
    const file = model.getRelativePath(candidate.uri);
    return { label: `${candidate.process.name || candidate.process.id} (${file})`, value: String(index) };
  });
  const dialogResult = await bifrost.dialog.open({
    title: 'Link to Existing Process',
    content: [
      { type: 'text', text: `Choose the process that "${placeholder.label}" stands for.` },
      { type: 'select', id: 'process', label: 'Process', value: entries[0]?.value, entries },
    ],
    actions: [
      { label: 'Cancel', response: 'cancel', cancel: true },
      { label: 'Link', response: 'link', default: true },
    ],
  });
  const chosen = candidates[Number(dialogResult.formData?.process)];
  if (dialogResult.wasCancelled || dialogResult.response !== 'link' || chosen == null) {
    return;
  }
  const isLinked = model.replacePlaceholderWithProcess(placeholderId, {
    processId: chosen.process.id,
    fileUri: chosen.uri,
  });
  if (!isLinked) {
    notify(
      bifrost,
      'info',
      `The placeholder could not be linked: it is gone, or "${chosen.process.id}" is already on this map.`,
    );
  }
}

/** The BPMN text of a new process named `name`, and the id the process gets from it. */
async function createProcessXml(
  bifrost: Bifrost,
  name: string,
  fileUri: string,
): Promise<{ xml: string; processId: string } | null> {
  const xml = await bifrost.commands.executeCommand<Promise<string>>('bpmn.diagram.getNewUniqueXml', [name]);
  const entry = parseSolutionBpmnModel({ uri: fileUri, text: xml, sha256: '' });
  const processId = entry.kind === 'bpmn' ? entry.processes[0]?.id : undefined;
  return processId == null ? null : { xml, processId };
}

/** The folders the new process can be saved in: every folder of the solution, and `processes/` next to the solution file. */
function getFolderEntries(bifrost: Bifrost, gate: ReadyLandscapeGate): { label: string; value: string }[] {
  const projects = bifrost.solution.getSolution()?.projects ?? [];
  const entries = projects
    .filter((project) => !isInLandscapeFolder(project.baseUri, gate.folderUri))
    .map((project) => ({ label: project.name, value: project.baseUri }));
  const newFolderUri = `${gate.solutionFileUri.slice(0, gate.solutionFileUri.lastIndexOf('/'))}/${NEW_FOLDER_NAME}`;
  if (!isInLandscapeFolder(newFolderUri, gate.folderUri) && !entries.some((entry) => entry.value === newFolderUri)) {
    entries.push({ label: `New folder "${NEW_FOLDER_NAME}" next to the solution file`, value: newFolderUri });
  }
  return entries;
}

function folderUriOf(bifrost: Bifrost, formData: DialogResult['formData']): string {
  const otherFolder = String(formData?.otherFolder ?? '');
  return otherFolder === '' ? String(formData?.folder) : bifrost.files.getUriForFilename(otherFolder);
}

/** What is wrong with the answers of the form, as errors at their fields; empty when the process can be created. */
async function validateModelForm(
  bifrost: Bifrost,
  gate: ReadyLandscapeGate,
  snapshot: LandscapeSolutionSnapshot,
  formData: DialogResult['formData'],
): Promise<DialogValidationError[]> {
  const name = String(formData?.name ?? '').trim();
  if (name === '') {
    return [{ contentId: 'name', errorLabel: 'Name cannot be empty' }];
  }
  if (FORBIDDEN_NAME_CHARACTERS.test(name) || bifrost.files.isInvalidFilename(name)) {
    return [{ contentId: 'name', errorLabel: 'The name is also the file name: avoid / \\ : * ? " < > | ^ and `' }];
  }
  const folderUri = folderUriOf(bifrost, formData);
  const hasOtherFolder = String(formData?.otherFolder ?? '') !== '';
  const folderField = hasOtherFolder ? 'otherFolder' : 'folder';
  if (isInLandscapeFolder(folderUri, gate.folderUri)) {
    return [
      {
        contentId: folderField,
        errorLabel: 'The landscape folder is read-only in the Designer. Choose another folder.',
      },
    ];
  }
  const fileUri = `${folderUri}/${name}.bpmn`;
  if (await bifrost.files.doesFileOrDirectoryExist(bifrost.files.getLocalFilenameForUri(fileUri))) {
    return [{ contentId: 'name', errorLabel: `${name}.bpmn already exists in that folder. Choose another name.` }];
  }
  const created = await createProcessXml(bifrost, name, fileUri);
  const existing = snapshot.catalog.find(
    (entry) => entry.kind === 'bpmn' && entry.processes.some((process) => process.id === created?.processId),
  );
  if (existing != null) {
    return [
      {
        contentId: 'name',
        errorLabel: `A process with the id ${created?.processId} already exists in ${bifrost.files.getFilename(existing.uri)}. Choose another name.`,
      },
    ];
  }
  return [];
}

/** Resolves once the scan lists `processId` in `fileUri`; `false` when it does not within the time limit. */
function waitForProcess(scan: LandscapeSolutionScan, fileUri: string, processId: string): Promise<boolean> {
  const isListed = (): boolean =>
    scan
      .getSnapshot()
      ?.catalog.some(
        (entry) =>
          entry.kind === 'bpmn' && entry.uri === fileUri && entry.processes.some((process) => process.id === processId),
      ) === true;
  if (isListed()) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const finish = (found: boolean): void => {
      clearTimeout(timeout);
      subscription.dispose();
      resolve(found);
    };
    const subscription = scan.onDidChange(() => {
      if (isListed()) {
        finish(true);
      }
    });
    const timeout = setTimeout(() => finish(false), SCAN_WAIT_MILLISECONDS);
    void scan.refresh();
  });
}

/** Writes the BPMN file, creating its folder first, and adds the folder to the solution when no folder holds it yet. */
async function saveProcessFile(
  bifrost: Bifrost,
  gate: ReadyLandscapeGate,
  target: { folderUri: string; fileUri: string; xml: string },
): Promise<void> {
  const { folderUri, fileUri, xml } = target;
  const folderPath = bifrost.files.getLocalFilenameForUri(folderUri);
  if (
    !(await bifrost.files.doesFileOrDirectoryExist(folderPath)) &&
    !(await bifrost.files.createDirectory(folderUri))
  ) {
    throw new Error(`The folder ${folderPath} could not be created.`);
  }
  if (!(await bifrost.files.save(fileUri, xml))) {
    throw new Error(`The file ${bifrost.files.getLocalFilenameForUri(fileUri)} could not be written.`);
  }
  const isInSolution = bifrost.solution
    .getSolution()
    ?.projects.some((project) => isInLandscapeFolder(fileUri, project.baseUri));
  if (isInSolution !== true) {
    bifrost.solution.addFolderToSolution(folderUri);
    if (!(await bifrost.solution.saveSolutionFile(gate.solutionFileUri))) {
      throw new Error(`The solution file could not be updated, so ${folderPath} is not part of the solution.`);
    }
  }
  await bifrost.solution.onElementAdded(fileUri);
}

/**
 * Creates a BPMN process for a placeholder from one form: name and folder. The folder joins the solution when it is
 * new to it. The placeholder then becomes the process and the Designer opens the new file.
 */
export async function modelPlaceholderAsProcess(
  bifrost: Bifrost,
  model: LandscapeMapDocumentModel,
  placeholderId: string,
  gate: ReadyLandscapeGate,
): Promise<void> {
  const placeholder = model.getPlaceholder(placeholderId);
  if (placeholder == null) {
    return;
  }
  const scan = bifrost.getSharedRessource<LandscapeSolutionScan>(LANDSCAPE_SOLUTION_SCAN_KEY);
  if (scan.getSnapshot() == null) {
    await scan.refresh();
  }
  const snapshot = scan.getSnapshot();
  if (snapshot == null) {
    notify(bifrost, 'warning', 'The solution could not be scanned, so a process id cannot be checked. Try again.');
    return;
  }
  const folderEntries = getFolderEntries(bifrost, gate);
  const hasProject = (bifrost.solution.getSolution()?.projects.length ?? 0) > 0;
  const dialogResult = await bifrost.dialog.open(
    {
      title: 'Model this Process',
      content: [
        {
          type: 'text',
          text: hasProject
            ? `Creates a BPMN file for "${placeholder.label}". The placeholder becomes this process, and the Designer opens it.`
            : `Creates a BPMN file for "${placeholder.label}". This solution has no project folder yet, so the file is saved in a new folder that is added to the solution. The placeholder becomes this process, and the Designer opens it.`,
        },
        { type: 'text_input', id: 'name', label: 'Name', value: placeholder.label, focus: true },
        { type: 'select', id: 'folder', label: 'Save in', value: folderEntries[0]?.value, entries: folderEntries },
        {
          type: 'path_picker',
          id: 'otherFolder',
          label: 'Other folder',
          mode: 'directory',
          placeholder: 'Optional; replaces the folder above',
          hint: 'A folder that is not part of the solution yet is added to it.',
        },
      ],
      actions: [
        { label: 'Cancel', response: 'cancel', cancel: true },
        { label: 'Create', response: 'create', default: true },
      ],
    },
    async (result: DialogResult): Promise<DialogValidationResult> => {
      if (result.response !== 'create') {
        return { closeDialog: true };
      }
      const validationErrors = await validateModelForm(bifrost, gate, snapshot, result.formData);
      return validationErrors.length === 0 ? { closeDialog: true } : { closeDialog: false, validationErrors };
    },
  );
  if (dialogResult.wasCancelled || dialogResult.response !== 'create') {
    return;
  }
  const name = String(dialogResult.formData?.name).trim();
  const folderUri = folderUriOf(bifrost, dialogResult.formData);
  const fileUri = `${folderUri}/${name}.bpmn`;
  const created = await createProcessXml(bifrost, name, fileUri);
  if (created == null) {
    notify(bifrost, 'error', `The process "${name}" could not be created from the BPMN template.`);
    return;
  }
  try {
    await saveProcessFile(bifrost, gate, { folderUri, fileUri, xml: created.xml });
  } catch (error) {
    notify(bifrost, 'error', error instanceof Error ? error.message : String(error));
    return;
  }
  if (!(await waitForProcess(scan, fileUri, created.processId))) {
    notify(
      bifrost,
      'error',
      `The process "${created.processId}" was saved to ${bifrost.files.getLocalFilenameForUri(fileUri)} but the solution scan did not list it. The placeholder is unchanged; link it from the properties pane once the scan has caught up.`,
    );
    return;
  }
  const isFilled = model.replacePlaceholderWithProcess(placeholderId, {
    processId: created.processId,
    fileUri,
  });
  if (!isFilled) {
    notify(
      bifrost,
      'info',
      `The process was saved to ${bifrost.files.getLocalFilenameForUri(fileUri)}, but the placeholder is gone from the map. Drag the process onto the map to place it.`,
    );
    return;
  }
  void bifrost.commands.executeCommand('std.editor.gotoSymbolInDocument', [fileUri, created.processId]);
}
