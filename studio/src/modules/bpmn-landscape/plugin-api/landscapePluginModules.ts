import { BpmnModelerModuleRegistry } from '#modules/bpmn-core/BpmnModelerModuleRegistry';
import { PluginBpmnContributionStore } from '#modules/bpmn-core/PluginBpmnContributionStore';
import { PluginModuleLoader } from '#modules/bpmn-core/plugin-modules/PluginModuleLoader';

/** The diagram-js modules that Studio modules and plugins add to every landscape map opened afterwards. */
export const landscapeModelerModuleRegistry = new BpmnModelerModuleRegistry();

/** Loads the renderer modules a plugin declares in `landscapeModules` into {@link landscapeModelerModuleRegistry}. */
export const landscapePluginModuleLoader = new PluginModuleLoader(landscapeModelerModuleRegistry);

/** The palette and context pad entries of plugins, read by the landscape palette and context pad providers. */
export const landscapeContributionStore = new PluginBpmnContributionStore();
