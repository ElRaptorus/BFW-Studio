import type { StudioEventSubscription } from '../contracts';

export declare abstract class StudioEventService {
  /**
   * Used to trigger a function after initialization:
   *
   *      studio.events.on("ready", () => {
   *        // at this point, the UI is done
   *        // all editors are open, all menu items are updated, the user interface is awaiting input
   *      })
   */
  on(eventName: 'ready', listener: () => void): StudioEventSubscription;

  /**
   * Used to trigger a function for all emitted 'unspecifiedGlobalUpdate' events:
   *
   *      studio.events.on("unspecifiedGlobalUpdate", () => {
   *        // ...
   *      })
   */
  on(eventName: 'unspecifiedGlobalUpdate', listener: () => void): StudioEventSubscription;

  /**
   * Used to trigger a function for all settings changes:
   *
   *      studio.events.on("settingsUpdate", (settingName: string, value: any) => {
   *        if (settingName === 'workbench.general.theme') {
   *          // ...
   *        }
   *      })
   */
  on(eventName: 'settingsUpdate', listener: (settingName: string, value: any) => void): StudioEventSubscription;

  /**
   * Used to trigger a function for when the opened solution changes:
   *
   *      studio.events.on("solutionChanged", (solutionName: string) => {
   *        if (solutionName === 'myFancySolution') {
   *          // ...
   *        }
   *      })
   */
  on(eventName: 'solutionChanged', listener: (solutionName: string) => void): StudioEventSubscription;

  /**
   * Fired when the set of registered plugin overlay factories changes
   * (factory registered or unregistered). BPMN-aware views subscribe
   * to this event to trigger an overlay refresh cycle.
   */
  on(eventName: 'pluginOverlayFactoriesChanged', listener: () => void): StudioEventSubscription;

  /**
   * Fired when the set of registered plugin DMN overlay factories changes
   * (factory registered or unregistered). DMN-aware views subscribe
   * to this event to trigger an overlay refresh cycle.
   */
  on(eventName: 'pluginDmnOverlayFactoriesChanged', listener: () => void): StudioEventSubscription;

  /**
   * Registers an event listener for a Studio Event, which is only executed once.
   */
  once(eventName: 'ready', listener: () => void): StudioEventSubscription;
  once(eventName: 'unspecifiedGlobalUpdate', listener: () => void): StudioEventSubscription;
  once(eventName: 'solutionChanged', listener: (solutionName: string) => void): StudioEventSubscription;
  once(eventName: 'settingsUpdate', listener: (settingName: string, value: any) => void): StudioEventSubscription;
  once(eventName: 'pluginOverlayFactoriesChanged', listener: () => void): StudioEventSubscription;
  once(eventName: 'pluginDmnOverlayFactoriesChanged', listener: () => void): StudioEventSubscription;

  /**
   * Emits an unspecified global update to trigger re-rendering of all UI components.
   *
   *      studio.events.emit("unspecifiedGlobalUpdate", (settingName: string, value: any) => {
   *        // ...
   *      })
   */
  emit(eventName: 'unspecifiedGlobalUpdate'): void;
  emit(eventName: 'pluginOverlayFactoriesChanged'): void;
  emit(eventName: 'pluginDmnOverlayFactoriesChanged'): void;
}
