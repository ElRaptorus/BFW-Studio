import type {
  PaneAreaAndGroup,
  PaneAreaName,
  PaneAreasSerialized,
  PaneObject,
  PaneProvider,
  PaneProviderModule,
} from '@evil/bifrost_fw_sdk';
import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import {
  EVENT_PANE_LAYOUT_UPDATED,
  EVENT_PANE_SIZE_UPDATED,
} from '../../../../studio-sdk/src/contracts/internal/PaneEvents';
import type { LocalStorageItem } from './LocalStorageItem';
import { PaneManager } from './PaneManager';
import { PaneProviderManager } from './PaneProviderManager';

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
export class PaneMediator extends AbstractEmitter {
  private paneManager: PaneManager;
  private paneProviderManager: PaneProviderManager;
  private paneStorage: LocalStorageItem;

  constructor(localStorage: LocalStorageItem) {
    super();
    this.paneManager = new PaneManager();
    this.paneProviderManager = new PaneProviderManager();
    this.paneStorage = localStorage;

    this.paneManager.on(EVENT_PANE_LAYOUT_UPDATED, () => this.emit(EVENT_PANE_LAYOUT_UPDATED));
    this.paneManager.on(EVENT_PANE_SIZE_UPDATED, () => this.emit(EVENT_PANE_SIZE_UPDATED));
  }

  restoreFromLastSession(): void {
    const paneData = this.paneStorage.load();
    this.paneManager.deserialize(paneData);

    const savePaneFn = () => {
      const paneData = this.paneManager.serialize();
      this.paneStorage.save(paneData);
    };
    this.paneManager.on(EVENT_PANE_LAYOUT_UPDATED, savePaneFn);
    this.paneManager.on(EVENT_PANE_SIZE_UPDATED, savePaneFn);
  }

  getViewData(): PaneAreasSerialized {
    return this.paneManager.getViewData();
  }

  getPaneAreaVisibility(name: PaneAreaName): boolean {
    return this.paneManager.getPaneAreaVisibility(name);
  }

  togglePaneArea(name: PaneAreaName): void {
    this.paneManager.togglePaneArea(name);
  }

  showPaneArea(name: PaneAreaName): void {
    this.paneManager.showPaneArea(name);
  }

  hidePaneArea(name: PaneAreaName): void {
    this.paneManager.hidePaneArea(name);
  }

  setVisibilityOfPaneAreaByPaneId(paneId: string, visible: boolean): void {
    this.paneManager.setVisibilityOfPaneAreaByPaneId(paneId, visible);
  }

  // TODO: the concept of pane groups with names/ids does not work well with draggable panes
  togglePaneAreaByPaneId(paneId: string): void {
    this.paneManager.togglePaneAreaByPaneId(paneId);
  }

  getPaneAreaAndGroupContainingPane(paneId: string): PaneAreaAndGroup {
    return this.paneManager.getPaneAreaAndGroupContainingPane(paneId);
  }

  alreadyRegistered(paneId: string): boolean {
    return this.paneManager.alreadyRegistered(paneId);
  }

  unregisterPane(paneId: string): void {
    this.paneManager.unregisterPane(paneId);
  }

  unregisterPaneGroup(paneGroupId: string): void {
    this.paneManager.unregisterPaneGroup(paneGroupId);
  }

  unregisterPaneProvider(providerId: string): void {
    this.paneProviderManager.unregister(providerId);
  }

  appendToPaneGroup(paneArea: PaneAreaName, paneGroupId: string, paneProviders: PaneObject[]): void {
    this.paneManager.appendToPaneGroup(paneArea, paneGroupId, paneProviders);
  }

  prependToPaneGroup(paneArea: PaneAreaName, paneGroupId: string, paneProviders: PaneObject[]): void {
    this.paneManager.prependToPaneGroup(paneArea, paneGroupId, paneProviders);
  }

  /**
   * Registers one or more `paneObjects`, creating a new group with the given `paneGroupId` in the given `paneArea`.
   *
   * Example:
   *
   *    bifrost.panes.registerPaneGroup('left', 'group-foo', [
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
  ): void {
    this.paneManager.registerPaneGroup(paneArea, paneGroupId, paneObjects, options);
  }

  setActiveGroupInArea(area: PaneAreaName, groupId: string): void {
    this.paneManager.setActiveGroupInArea(area, groupId);
  }

  requestPaneLayoutUpdate(): void {
    this.paneManager.requestPaneLayoutUpdate();
  }

  /**
   * Registers a new `paneProviderModule` with the given `providerId`.
   *
   * This is used to be able to reference different types of panes by their `providerId`.
   *
   * Example:
   *
   *    bifrost.panes.registerPaneProvider('foo/pane-providers/bar', require('./panes/FoobarPane'));
   *
   * The required module has to export a member `paneProvider` that conforms to the `PaneProvider` type.
   *
   * Now we can reference this pane provider using `foo/pane-providers/bar`, when registering a new pane
   * in a "pane group":
   *
   *    bifrost.panes.registerPaneGroup('left', 'group-foo', [
   *      { id: 'foo/bar', providerId: 'foo/pane-providers/bar' }
   *    ]);
   *
   */
  registerPaneProvider(providerId: string, paneProviderModule: PaneProviderModule): void {
    this.paneProviderManager.register(providerId, paneProviderModule);
  }

  /**
   * Registers a new `paneProviderModule` with the given `providerId` and returns a "usable" `PaneObject` that can
   * be appended or prepended to existing pane groups.
   *
   * Example:
   *
   *    bifrost.panes.getPaneViaPaneProvider('foo/panes/bar', 'foo/providers/bar', require('./panes/FooBarPane'));
   *
   * The required module has to export a member `paneProvider` that conforms to the `PaneProvider` type.
   *
   * We can use the return value directly when registering a new pane in a "pane group":
   *
   *    bifrost.panes.registerPaneGroup('left', 'group-foo', [
   *      bifrost.panes.getPaneViaPaneProvider('foo/panes/bar', 'foo/providers/bar', require('./panes/FooBarPane'))
   *    ]);
   *
   */
  getPaneViaPaneProvider(paneId: string, providerId: string, paneProviderModule: PaneProviderModule): PaneObject {
    this.paneProviderManager.register(providerId, paneProviderModule);

    return {
      id: paneId,
      providerId: providerId,
      collapsed: false,
    };
  }

  updatePaneAreaSize(paneAreaId: PaneAreaName, pixels: number): void {
    this.paneManager.updatePaneAreaSize(paneAreaId, pixels);
  }

  setActivePane(paneArea: PaneAreaName, paneAreaIndex: number, index: number): void {
    this.paneManager.setActivePane(paneArea, paneAreaIndex, index);
  }

  getActivePaneIdForArea(area: PaneAreaName): string | null {
    return this.paneManager.getActivePaneIdForArea(area);
  }

  selectLastActivePaneInArea(area: PaneAreaName): void {
    this.paneManager.selectLastActivePaneInArea(area);
  }

  isPaneGroupVisibleByPaneId(paneId: string): boolean {
    return this.paneManager.isPaneGroupVisibleByPaneId(paneId);
  }

  setPaneCollapsed(paneId: string, collapsed: boolean): void {
    this.paneManager.setPaneCollapsed(paneId, collapsed);
  }

  movePane(
    origPaneArea: PaneAreaName,
    origPaneAreaIndex: number,
    origIndex: number,
    destPaneArea: PaneAreaName,
    destPaneAreaIndex: number,
    destIndex: number,
  ): void {
    this.paneManager.movePane(origPaneArea, origPaneAreaIndex, origIndex, destPaneArea, destPaneAreaIndex, destIndex);
  }

  /**
   * Used to retrieve a `PaneProvider` by its `providerId`. The `PaneProvider` has to be registered via `` beforehand.
   */
  getPaneProvider(providerId: string): PaneProvider {
    const paneProvider = this.paneProviderManager.getById(providerId);

    return paneProvider;
  }

  reset(): void {
    this.paneManager.reset();
  }

  clearInstance(): void {
    this.paneStorage.clear();
  }

  emitPaneSizeChanged(): void {
    this.emit(EVENT_PANE_SIZE_UPDATED);
  }
}
