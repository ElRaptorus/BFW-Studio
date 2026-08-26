import { Bifrost } from '#bifrost/Bifrost';
import type { BifrostOptions } from '#bifrost/contracts/BifrostTypes';
import { Icon } from '#components/Icon';

import './dayjsSetup';

/**
 * Internal: Used by both all target entrypoints (embed, electron, webapp) to create and subsequently initialize Bifrost.
 * @async
 */
export async function createAndInitializeBifrost(
  uiRoot: any = document.body,
  args?: BifrostOptions,
  initializeCallbackFn?: (bifrost: Bifrost) => Promise<void>,
): Promise<Bifrost> {
  const bifrost = Bifrost.create(uiRoot, args);

  await bifrost.initialize(async () => {
    bifrost.icons.setComponent(Icon);

    await bifrost.modules.requirePackagedModule('std');
    await bifrost.modules.requirePackagedModule('themes');

    await bifrost.modules.requirePackagedModule('bpmn-core');
    await bifrost.modules.requirePackagedModule('bpmn-editor');
    await bifrost.modules.requirePackagedModule('bpmn-token-simulator');
    await bifrost.modules.requirePackagedModule('bpmn-linter');
    await bifrost.modules.requirePackagedModule('bpmn-diff');

    await bifrost.modules.requirePackagedModule('dmn-core');
    await bifrost.modules.requirePackagedModule('dmn-editor');
    await bifrost.modules.requirePackagedModule('dmn-diff');

    await bifrost.modules.requirePackagedModule('git-cruiser');

    await bifrost.modules.requirePackagedModule('machine-sanctum');

    await bifrost.modules.requirePackagedModule('engine-core');
    await bifrost.modules.requirePackagedModule('engine-workspace');
    await bifrost.modules.requirePackagedModule('engine-model-viewer');
    await bifrost.modules.requirePackagedModule('engine-decision-viewer');
    await bifrost.modules.requirePackagedModule('engine-debugger');

    await bifrost.modules.requirePackagedModule('plugins');
    if (initializeCallbackFn != null) {
      await initializeCallbackFn(bifrost);
    }
  });

  return bifrost;
}
