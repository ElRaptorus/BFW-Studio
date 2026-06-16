/**
 * Provides read-only access to a bpmn-js modeler instance's internal components.
 *
 * Plugins use this to retrieve diagram-js modules they registered via
 * `bpmn.modeler.registerModule` at init time.
 */
export declare class BpmnModelerComponentAdapter {
  /**
   * Retrieves a named diagram-js component (service) from the underlying modeler.
   *
   * The name corresponds to the key used in the diagram-js module definition,
   * e.g. `'tokenSimulationBridge'` for a module registered as
   * `{ tokenSimulationBridge: ['type', BridgeConstructor] }`.
   */
  getModelerComponentByName<T = any>(name: string): T;

  /**
   * Returns `true` once the modeler has finished initializing, attaching and rendering.
   */
  isReadyForInteraction(): boolean;

  /**
   * Run the given `callbackFn` once the modeler is interactive.
   */
  onceInteractive(callbackFn: (...args: any[]) => any): void;
}
