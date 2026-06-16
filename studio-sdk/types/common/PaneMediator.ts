import type { PaneAreaName, PaneObject, PaneProviderModule } from '../../src';

/**
 * Panes are small window-like views displayed in the sidebars, e.g. the File Explorer.
 *
 * `PaneMediator` exists to keep track of several "pane areas" on screen. There are three pane areas
 * "top", "bottom" and "right", where panes can be displayed.
 *
 * PaneManager also provides methods to register pane providers and move panes between pane areas.
 *
 * The `PaneMediator` connects an instance of `PaneManager` and an instance for storing its session state.
 *
 * This is done so that the `Manager`, which knows about holding, interpreting and discarding information,
 * does not need to know about storing information, which is the job of the `LocalStorageItem` class.
 *
 * We gain more clarity about the jobs by separating the two (there are other benefits as well, such as being able to
 * independently test both classes).
 *
 * But since our app wants to manage *and* store information, we implement a `Mediator` class which brings the two
 * together and provides a fascade for those functions that should be exposed at the app-level.
 */
export declare class PaneMediator {
  /**
   * Removes a single pane from whichever group contains it.
   * Emits `EVENT_PANE_LAYOUT_UPDATED` so the pane area re-renders.
   */
  unregisterPane(paneId: string): void;

  /**
   * Removes an entire pane group (and all panes inside it) from whichever area contains it.
   * Emits `EVENT_PANE_LAYOUT_UPDATED` so the pane area re-renders.
   */
  unregisterPaneGroup(paneGroupId: string): void;

  /**
   * Removes a previously registered pane provider.
   */
  unregisterPaneProvider(providerId: string): void;

  appendToPaneGroup(paneArea: PaneAreaName, paneGroupId: string, paneProviders: PaneObject[]): void;

  prependToPaneGroup(paneArea: PaneAreaName, paneGroupId: string, paneProviders: PaneObject[]): void;

  /**
   * Registers one or more `paneObjects`, creating a new group with the given `paneGroupId` in the given `paneArea`.
   *
   * Example:
   *
   *    studio.panes.registerPaneGroup('left', 'group-foo', [
   *      { id: 'foo/bar', providerId: 'foo/pane-providers/bar' }
   *    ]);
   *
   * It is important to note that there are three Ids in this example:
   *
   *  * `group-foo` is the id of the newly registered pane group
   *  * `foo/bar` is the id of the newly registered pane object inside that group
   *  * `foo/pane-providers/bar` is the id of the previously registered pane provider (see `registerPaneProvider`)
   *
   */
  registerPaneGroup(
    paneArea: PaneAreaName,
    paneGroupId: string,
    paneObjects: PaneObject[],
    options?: { label?: string; icon?: string | (() => string) },
  ): void;

  setActiveGroupInArea(area: PaneAreaName, groupId: string): void;

  showPaneArea(name: PaneAreaName): void;

  requestPaneLayoutUpdate(): void;

  /**
   * Registers a new `paneProviderModule` with the given `providerId`.
   *
   * This is used to be able to reference different types of panes by their `providerId`.
   *
   * Example:
   *
   *    studio.panes.registerPaneProvider('foo/pane-providers/bar', require('./panes/BarActivityPane'));
   *
   * The required module has to export a member `paneProvider` that conforms to the `PaneProvider` type.
   *
   * Now we can reference this pane provider using `foo/pane-providers/bar`, when registering a new pane
   * in a "pane group":
   *
   *    studio.panes.registerPaneGroup('left', 'group-foo', [
   *      { id: 'foo/bar', providerId: 'foo/pane-providers/bar' }
   *    ]);
   *
   */
  registerPaneProvider(providerId: string, paneProviderModule: PaneProviderModule): void;

  /**
   * Registers a new `paneProviderModule` with the given `providerId` and returns a "usable" `PaneObject` that can
   * be appended or prepended to existing pane groups.
   *
   * Example:
   *
   *    studio.panes.getPaneViaPaneProvider('foo/panes/bar', 'foo/providers/bar', require('./panes/FooBarPane'));
   *
   * The required module has to export a member `paneProvider` that conforms to the `PaneProvider` type.
   *
   * We can use the return value directly when registering a new pane in a "pane group":
   *
   *    studio.panes.registerPaneGroup('left', 'group-foo', [
   *      studio.panes.getPaneViaPaneProvider('foo/panes/bar', 'foo/providers/bar', require('./panes/FooBarPane'))
   *    ]);
   *
   */
  getPaneViaPaneProvider(paneId: string, providerId: string, paneProviderModule: PaneProviderModule): PaneObject;

  /**
   * Returns `true` when the pane group that contains the given `paneId` is the
   * currently visible group in its area **and** that area itself is visible.
   */
  isPaneGroupVisibleByPaneId(paneId: string): boolean;
}
