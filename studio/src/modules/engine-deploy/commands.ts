import type { Bifrost } from '#bifrost/Bifrost';
import type { TreeViewMediator } from '#bifrost/browser/TreeViewMediator';

import type { DeployExplorerMetadata } from './analysis/buildDeployExplorerTree';
import type DeployPlanDocumentModel from './models/DeployPlanDocumentModel';
import { DEPLOY_PLAN_URI } from './models/DeployPlanDocumentModel';

export const DEPLOY_EXPLORER_VIEW_ID = 'engine/deploy-explorer';

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

export function registerDeployPlanCommands(bifrost: Bifrost): void {
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

  bifrost.commands.register('engine.deploy.addMissingDependencies', async () => {
    await getPlanModelIfPresent(bifrost)?.addMissingDependencies();
  });

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
