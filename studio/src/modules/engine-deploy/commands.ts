import type { Bifrost } from '#bifrost/Bifrost';
import type { TreeViewMediator } from '#bifrost/browser/TreeViewMediator';
import { StandardDialogResponse } from '#bifrost/contracts/DialogTypes';
import * as path from 'path';

import type { DeployExplorerMetadata, DeployExplorerMode } from './analysis/buildDeployExplorerTree';
import type { DeployPackage } from './analysis/deployPackages';
import {
  findPackage,
  readPackages,
  removePackage,
  toPackageFileUri,
  toRelativePackagePath,
  upsertPackage,
  validatePackageName,
} from './analysis/deployPackages';
import type DeployPlanDocumentModel from './models/DeployPlanDocumentModel';
import { DEPLOY_PLAN_URI } from './models/DeployPlanDocumentModel';

export const DEPLOY_EXPLORER_VIEW_ID = 'engine/deploy-explorer';
export const DEPLOY_PACKAGES_SETTING = 'engine.deploy.packages';
export const DEPLOY_PACKAGES_MENU_ID = 'engine/deploy-explorer/packages';

const explorerRescanListeners = new Set<() => void>();

/** The Deploy Explorer rescans the solution whenever `engine.deploy.rescanExplorer` runs. */
export function onExplorerRescanRequested(listener: () => void): { dispose: () => void } {
  explorerRescanListeners.add(listener);
  return { dispose: () => explorerRescanListeners.delete(listener) };
}

/**
 * Where packages are stored. Paths are relative to the solution file's folder (or the single opened folder). The
 * resource inside the first project makes the setting resolve in the Solution layer when there is one.
 */
export function getPackageStorage(bifrost: Bifrost): { baseUri: string; resourceUri: string } | null {
  const solution = bifrost.solution.getSolution();
  const firstProject = solution?.projects[0];
  if (solution == null || firstProject == null) {
    return null;
  }
  const baseUri =
    solution.solutionFileUri != null
      ? solution.solutionFileUri.slice(0, solution.solutionFileUri.lastIndexOf('/'))
      : firstProject.baseUri;
  return { baseUri, resourceUri: `${firstProject.baseUri}/` };
}

export function readDeployPackages(bifrost: Bifrost): DeployPackage[] {
  const storage = getPackageStorage(bifrost);
  return readPackages(bifrost.settings.get(DEPLOY_PACKAGES_SETTING, storage?.resourceUri));
}

async function confirmAction(bifrost: Bifrost, title: string, text: string, actionLabel: string): Promise<boolean> {
  const result = await bifrost.dialog.open({
    title,
    content: [{ type: 'text', text }],
    actions: [{ label: actionLabel, response: StandardDialogResponse.Submit, default: true }],
  });
  return !result.wasCancelled && result.response === StandardDialogResponse.Submit;
}

async function askPackageName(bifrost: Bifrost, defaultName: string): Promise<string | null> {
  const result = await bifrost.dialog.open(
    {
      title: 'Save Deploy Package',
      content: [{ type: 'text_input', id: 'name', label: 'Package name', value: defaultName, focus: true }],
      actions: [{ label: 'Save', response: StandardDialogResponse.Submit, default: true }],
    },
    async (dialogResult) => {
      const message = validatePackageName(String(dialogResult.formData?.name ?? ''));
      return dialogResult.response !== StandardDialogResponse.Submit || message == null
        ? { closeDialog: true }
        : { closeDialog: false, validationErrors: [{ contentId: 'name', errorLabel: message }] };
    },
  );
  return result.wasCancelled ? null : String(result.formData?.name ?? '').trim();
}

export function getPlanModelIfPresent(bifrost: Bifrost): DeployPlanDocumentModel | null {
  const editorDocument = bifrost.editors.getEditorDocumentByUri(DEPLOY_PLAN_URI);
  return editorDocument == null
    ? null
    : bifrost.editors.getEditorDocumentModelIfPresent<DeployPlanDocumentModel>(editorDocument);
}

async function openPlanModel(bifrost: Bifrost): Promise<DeployPlanDocumentModel> {
  const editorDocument = bifrost.editors.focusOrOpenEditorDocument(DEPLOY_PLAN_URI, 'Deploy Plan');
  return bifrost.editors.getEditorDocumentModel<DeployPlanDocumentModel>(editorDocument);
}

/** The model files below the selected Deploy Explorer items (folders contribute every model below them). */
export function collectSelectedModelUris(selectedMetadata: readonly DeployExplorerMetadata[]): string[] {
  return [...new Set(selectedMetadata.flatMap((metadata) => metadata?.modelUris ?? []))];
}

async function writePackages(bifrost: Bifrost, packages: DeployPackage[]): Promise<boolean> {
  const storage = getPackageStorage(bifrost);
  const target = await bifrost.settings.set(DEPLOY_PACKAGES_SETTING, packages, storage?.resourceUri);
  return target != null;
}

function registerDeployPackageCommands(bifrost: Bifrost): void {
  bifrost.commands.register('engine.deploy.loadPackage', async (name: string) => {
    const storage = getPackageStorage(bifrost);
    const deployPackage = findPackage(readDeployPackages(bifrost), name);
    if (storage == null || deployPackage == null) {
      return;
    }
    const uris = deployPackage.files.map((file) => toPackageFileUri(file, storage.baseUri));
    const existing: string[] = [];
    const missing: string[] = [];
    for (const uri of uris) {
      const exists = await bifrost.files.doesFileOrDirectoryExist(uri.replace(/^file:\/\//, ''));
      (exists ? existing : missing).push(uri);
    }
    await (await openPlanModel(bifrost)).replaceItems(existing);
    if (missing.length > 0) {
      bifrost.notifications.open({
        type: 'warning',
        content: `${missing.length} file(s) of package '${deployPackage.name}' no longer exist and were skipped: ${missing
          .map((uri) => path.posix.basename(uri))
          .join(', ')}`,
        source: 'Deploy',
      });
    }
  });

  bifrost.commands.register(
    'engine.deploy.savePlanAsPackage',
    async () => {
      const storage = getPackageStorage(bifrost);
      const planUris = getPlanModelIfPresent(bifrost)?.getPlanUris() ?? [];
      if (storage == null || planUris.length === 0) {
        return;
      }
      const name = await askPackageName(bifrost, '');
      if (name == null) {
        return;
      }
      const packages = readDeployPackages(bifrost);
      if (
        findPackage(packages, name) != null &&
        !(await confirmAction(bifrost, 'Replace Package', `A package named '${name}' exists. Replace it?`, 'Replace'))
      ) {
        return;
      }
      const files = planUris.map((uri) => toRelativePackagePath(uri, storage.baseUri));
      if (await writePackages(bifrost, upsertPackage(packages, name, files))) {
        bifrost.notifications.open({
          type: 'info',
          content: `Saved package '${name}' with ${files.length} file(s).`,
          source: 'Deploy',
        });
      }
    },
    { enabledWhen: () => (getPlanModelIfPresent(bifrost)?.getPlanUris().length ?? 0) > 0 },
  );

  bifrost.commands.register('engine.deploy.deletePackage', async (name: string) => {
    if (await confirmAction(bifrost, 'Delete Package', `Delete the package '${name}'?`, 'Delete')) {
      await writePackages(bifrost, removePackage(readDeployPackages(bifrost), name));
    }
  });
}

export function registerDeployPlanCommands(bifrost: Bifrost): void {
  registerDeployPackageCommands(bifrost);

  bifrost.commands.register('engine.deploy.rescanExplorer', () => {
    explorerRescanListeners.forEach((listener) => listener());
  });

  bifrost.commands.register('engine.deploy.setExplorerMode', async (mode: DeployExplorerMode) => {
    (getPlanModelIfPresent(bifrost) ?? (await openPlanModel(bifrost))).setExplorerMode(mode);
  });

  bifrost.commands.register('engine.deploy.addToPlan', async (uris: string[]) => {
    await (await openPlanModel(bifrost)).addItems(uris);
  });

  bifrost.commands.register('engine.deploy.addSelectedToPlan', async () => {
    const mediator = bifrost.views.getById<TreeViewMediator>(DEPLOY_EXPLORER_VIEW_ID);
    const uris = collectSelectedModelUris(mediator.getSelectedMetadata());
    if (uris.length === 0) {
      bifrost.notifications.open({
        type: 'info',
        content: 'The selection contains no BPMN or DMN files.',
        source: 'Deploy',
      });
      return;
    }
    await bifrost.commands.executeCommand('engine.deploy.addToPlan', [uris]);
  });

  bifrost.commands.register('engine.deploy.removeFromPlan', async (uri: string) => {
    await getPlanModelIfPresent(bifrost)?.removeItem(uri);
  });

  bifrost.commands.register(
    'engine.deploy.addMissingDependencies',
    async () => {
      await getPlanModelIfPresent(bifrost)?.addMissingDependencies();
    },
    { enabledWhen: () => (getPlanModelIfPresent(bifrost)?.getMissingLocalDependencyUris().length ?? 0) > 0 },
  );

  bifrost.commands.register(
    'engine.deploy.removeSelectedFromPlan',
    async () => {
      const model = getPlanModelIfPresent(bifrost);
      const selectedUris = [...(model?.getIncludedUris() ?? [])];
      if (model == null || selectedUris.length === 0) {
        return;
      }
      if (
        await confirmAction(
          bifrost,
          'Remove Selected from Plan',
          `Remove the ${selectedUris.length} selected ${selectedUris.length === 1 ? 'file' : 'files'} from the plan? Your files and the Engine are not touched.`,
          'Remove',
        )
      ) {
        await model.removeItems(selectedUris);
      }
    },
    { enabledWhen: () => (getPlanModelIfPresent(bifrost)?.getIncludedUris().size ?? 0) > 0 },
  );

  bifrost.commands.register(
    'engine.deploy.resetPlan',
    async () => {
      const model = getPlanModelIfPresent(bifrost);
      if (model == null) {
        return;
      }
      const count = model.getPlanUris().length;
      if (
        await confirmAction(
          bifrost,
          'Reset Deploy Plan',
          `Remove all ${count} ${count === 1 ? 'file' : 'files'} from the plan? Saved packages are not affected.`,
          'Reset',
        )
      ) {
        await model.replaceItems([]);
      }
    },
    { enabledWhen: () => (getPlanModelIfPresent(bifrost)?.getPlanUris().length ?? 0) > 0 },
  );

  bifrost.commands.register('engine.deploy.refreshPlan', async () => {
    await getPlanModelIfPresent(bifrost)?.refresh();
  });

  bifrost.commands.register(
    'engine.deploy.deployPlan',
    async () => {
      const model = getPlanModelIfPresent(bifrost);
      if (model == null) {
        return;
      }
      const results = await model.deploy();
      const deployedCount = results.filter((result) => result.status === 'deployed').length;
      bifrost.notifications.open({
        type: deployedCount === results.length ? 'info' : 'warning',
        content: `Deployed ${deployedCount} of ${results.length} file(s).`,
        source: 'Deploy',
      });
    },
    { enabledWhen: () => getPlanModelIfPresent(bifrost)?.canDeploy() === true },
  );
}
