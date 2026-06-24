/**
 * Collects diagram-js modules registered by extensions at init time.
 *
 * Extensions register modules during their `onLoad` phase via the
 * `bpmn.modeler.registerModule` command. When a BPMN document is opened,
 * BpmnDocumentModel reads all registered modules and passes them to
 * BpmnModelerComponentAdapter as `additionalModules`.
 *
 * Plugin modules are tracked per-plugin so they can be unregistered
 * when the plugin is disabled or uninstalled. Core modules registered
 * via the plain `register()` method are permanent.
 */
class BpmnModelerModuleRegistry {
  private modules: any[] = [];
  private pluginModules = new Map<string, any[]>();

  register(module: any): void {
    this.modules.push(module);
  }

  registerPluginModule(pluginName: string, module: any): void {
    const existing = this.pluginModules.get(pluginName);
    if (existing != null) {
      existing.push(module);
    } else {
      this.pluginModules.set(pluginName, [module]);
    }
  }

  unregisterPluginModules(pluginName: string): void {
    this.pluginModules.delete(pluginName);
  }

  hasPluginModules(pluginName: string): boolean {
    const modules = this.pluginModules.get(pluginName);
    return modules != null && modules.length > 0;
  }

  getAll(): any[] {
    const allPluginModules = [...this.pluginModules.values()].flat();
    return [...this.modules, ...allPluginModules];
  }
}

export const bpmnModelerModuleRegistry = new BpmnModelerModuleRegistry();
