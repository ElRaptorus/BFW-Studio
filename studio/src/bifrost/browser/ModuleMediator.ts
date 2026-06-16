import type { Bifrost } from '../Bifrost';
import type { ModuleManager, StudioModule } from '../common/ModuleManager';

export class ModuleMediator {
  private moduleManager: ModuleManager;
  private bifrost: Bifrost;

  constructor(bifrost: Bifrost, moduleManager: ModuleManager) {
    this.bifrost = bifrost;
    this.moduleManager = moduleManager;
  }

  getLoadedModules(): StudioModule[] {
    return this.moduleManager.getLoadedModules();
  }

  getModuleExports(moduleName: string): any {
    return this.moduleManager.getModuleExports(moduleName);
  }

  async requirePackagedModule(moduleName: string): Promise<void> {
    this.bifrost.performance.mark(`bifrost:requirePackagedModule ${moduleName} #start`);

    try {
      await this.moduleManager.loadPackagedModule(moduleName);
    } catch (e) {
      console.error(`Error while loading packaged module '${moduleName}':`, e);
      const content = `Error while loading module '${moduleName}'.\n\n${e.message}`;

      this.bifrost.commands.executeCommand('std.notifications.showError', [content, `pack:${moduleName}`]);
    }

    this.bifrost.performance.mark(`bifrost:requirePackagedModule ${moduleName} #end`);
  }
}
