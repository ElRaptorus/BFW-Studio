/**
 * Collects diagram-js modules registered by extensions at init time.
 *
 * Extensions register modules during their `onLoad` phase via the
 * `dmn.modeler.registerModule` command. When a DMN document is opened,
 * DmnDocumentModel reads all registered modules and passes them to
 * DmnModelerComponentAdapter as `additionalModules`.
 */
class DmnModelerModuleRegistry {
  private modules: any[] = [];

  register(module: any): void {
    this.modules.push(module);
  }

  getAll(): any[] {
    return [...this.modules];
  }
}

export const dmnModelerModuleRegistry = new DmnModelerModuleRegistry();
