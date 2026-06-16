/**
 * Collects diagram-js modules registered by extensions at init time.
 *
 * Extensions register modules during their `onLoad` phase via the
 * `bpmn.modeler.registerModule` command. When a BPMN document is opened,
 * BpmnDocumentModel reads all registered modules and passes them to
 * BpmnModelerComponentAdapter as `additionalModules`.
 */
class BpmnModelerModuleRegistry {
  private modules: any[] = [];

  register(module: any): void {
    this.modules.push(module);
  }

  getAll(): any[] {
    return [...this.modules];
  }
}

export const bpmnModelerModuleRegistry = new BpmnModelerModuleRegistry();
