import { assertNotNull } from '@evil/bifrost_fw_sdk';

export type StudioModule = {
  name: string;
  module: { id: string; exports: any };
  isLoaded: boolean;
};

export class ModuleManager {
  private modules: StudioModule[] = [];
  private moduleOnLoadArgs: any[];

  constructor(moduleOnLoadArgs: any[]) {
    this.moduleOnLoadArgs = moduleOnLoadArgs;
  }

  getLoadedModules(): StudioModule[] {
    return this.modules.filter((studioModule) => {
      return studioModule.isLoaded;
    });
  }

  getModuleExports(moduleName: string): any {
    const studioModule = this.modules.find((entry: StudioModule) => entry.name === moduleName);
    if (studioModule == null) {
      throw new Error(`Could not find a module with the name '${moduleName}'`);
    }
    const exports = studioModule.module?.exports;
    assertNotNull(exports, 'studioModule.module.exports');

    return exports;
  }

  async loadPackagedModule(moduleName: string): Promise<StudioModule> {
    const id = `packaged:modules/${moduleName}/index`;
    const exports = require(`../../modules/${moduleName}/index`);
    const loadedModule = {
      id: id,
      exports: exports,
    };

    const studioModule: StudioModule = {
      name: moduleName,
      module: loadedModule,
      isLoaded: true,
    };

    this.modules.push(studioModule);

    if (studioModule.module.exports.onLoad != null) {
      await studioModule.module.exports.onLoad.apply(null, this.moduleOnLoadArgs);
    } else {
      console.warn(`Module '${moduleName}' does not export an onLoad callback.`);
    }

    return studioModule;
  }
}
