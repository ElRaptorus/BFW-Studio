import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type {
  PaneAreaAndGroup,
  PaneAreaName,
  PaneAreaObject,
  PaneAreasSerialized,
  PaneGroupObject,
  PaneObject,
} from '#bifrost/contracts/PaneTypes';
import { EVENT_PANE_LAYOUT_UPDATED, EVENT_PANE_SIZE_UPDATED } from '#bifrost/contracts/internal/PaneEvents';

import type { ISerializable } from '../contracts/SerializableTypes';

const ALL_PANE_AREA_NAMES: PaneAreaName[] = ['left', 'bottom', 'right'];

type PaneAreas = {
  readonly left: PaneAreaObject;
  readonly right: PaneAreaObject;
  readonly bottom: PaneAreaObject;
};

type PaneAreaPageState = {
  visible: boolean;
  sizeInPixels: number;
  activeGroupId: string | null;
  lastActivePaneId: string | null;
};

type PagePaneState = {
  areas: Record<PaneAreaName, PaneAreaPageState>;
  activePaneIndexPerGroup: Record<string, number>;
};

export type PaneManagerSerialized = {
  version: 2;
  pages: Record<string, PagePaneState>;
  collapsed: Record<string, boolean>;
};

/**
 * Holds all pane groups of all pages. Each group lists the pages it appears on (`null` = every page).
 * The visibility, size and active group of each area, and the active pane of each group, are kept per page and
 * swapped in when the active page changes.
 */
export class PaneManager extends AbstractEmitter implements ISerializable {
  private paneAreas: PaneAreas;
  private lastActivePaneIdPerArea: Record<PaneAreaName, string | null>;
  private readonly pagesPerGroup = new Map<string, string[] | null>();
  private pageStates: Record<string, PagePaneState> = {};
  private activePageId: string | null = null;
  private allowedAreasOfPage: (pageId: string) => readonly PaneAreaName[] = () => ALL_PANE_AREA_NAMES;
  private requestPageActivation: (pageId: string) => void = () => {};
  private pagesConfigured = false;

  constructor() {
    super();

    this.paneAreas = this.getDefaultSettings();
    this.lastActivePaneIdPerArea = { left: null, bottom: null, right: null };
  }

  /** Called by the mediator: which areas a page may show, and how to switch to the page of a pane. */
  configurePages(
    allowedAreasOfPage: (pageId: string) => readonly PaneAreaName[],
    requestPageActivation: (pageId: string) => void,
  ): void {
    this.allowedAreasOfPage = allowedAreasOfPage;
    this.requestPageActivation = requestPageActivation;
    this.pagesConfigured = true;
  }

  getActivePageId(): string | null {
    return this.activePageId;
  }

  /** Stores the state of the current page and restores the state of `pageId` (defaults for a page seen first). */
  setActivePage(pageId: string | null): void {
    if (pageId === this.activePageId) {
      return;
    }
    if (this.activePageId != null) {
      this.pageStates[this.activePageId] = this.captureCurrentPageState();
    }
    this.activePageId = pageId;
    if (pageId != null) {
      this.applyPageState(pageId);
    }
    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  /** Format v2 only; state without `version: 2` is ignored and the defaults stay in place. */
  deserialize(dump: any): void {
    if (dump?.version !== 2 || dump.pages == null) {
      return;
    }
    const restored = JSON.parse(JSON.stringify(dump)) as PaneManagerSerialized;
    this.pageStates = restored.pages;
    for (const [paneId, collapsed] of Object.entries(restored.collapsed ?? {})) {
      for (const area of ALL_PANE_AREA_NAMES) {
        for (const group of this.paneAreas[area].paneGroups) {
          const pane = group.panes.find((candidate) => candidate.id === paneId);
          if (pane != null) {
            (pane as any).collapsed = collapsed;
          }
        }
      }
    }
    if (this.activePageId != null) {
      this.applyPageState(this.activePageId);
    }
  }

  serialize(): PaneManagerSerialized {
    const pages = { ...this.pageStates };
    if (this.activePageId != null) {
      pages[this.activePageId] = this.captureCurrentPageState();
    }
    const collapsed: Record<string, boolean> = {};
    for (const area of ALL_PANE_AREA_NAMES) {
      for (const group of this.paneAreas[area].paneGroups) {
        for (const pane of group.panes) {
          collapsed[pane.id] = pane.collapsed;
        }
      }
    }
    return { version: 2, pages, collapsed };
  }

  /**
   * The areas as seen from the active page: only groups and areas that belong to it.
   * With pages configured but no active page (an empty category), every area is empty.
   */
  getViewData(): PaneAreasSerialized {
    if (this.activePageId == null && !this.pagesConfigured) {
      return this.paneAreas;
    }
    const allowedAreas: readonly PaneAreaName[] =
      this.activePageId == null ? [] : this.allowedAreasOfPage(this.activePageId);
    const viewOf = (name: PaneAreaName): PaneAreaObject => {
      const area = this.paneAreas[name];
      const paneGroups = allowedAreas.includes(name) ? this.getGroupsOnActivePage(name) : [];
      return { ...area, visible: area.visible && paneGroups.length > 0, paneGroups };
    };
    return { left: viewOf('left'), right: viewOf('right'), bottom: viewOf('bottom') };
  }

  private isGroupOnPage(group: PaneGroupObject, pageId: string | null): boolean {
    const pages = this.pagesPerGroup.get(group.groupId);
    return pages == null || pageId == null || pages.includes(pageId);
  }

  private getGroupsOnActivePage(name: PaneAreaName): PaneGroupObject[] {
    return this.paneAreas[name].paneGroups.filter((group) => this.isGroupOnPage(group, this.activePageId));
  }

  private captureCurrentPageState(): PagePaneState {
    const areas = {} as Record<PaneAreaName, PaneAreaPageState>;
    const activePaneIndexPerGroup: Record<string, number> = {};
    for (const name of ALL_PANE_AREA_NAMES) {
      const area = this.paneAreas[name];
      areas[name] = {
        visible: area.visible,
        sizeInPixels: area.sizeInPixels,
        activeGroupId: this.getGroupsOnActivePage(name).find((group) => group.visible)?.groupId ?? null,
        lastActivePaneId: this.lastActivePaneIdPerArea[name],
      };
      for (const group of this.getGroupsOnActivePage(name)) {
        activePaneIndexPerGroup[group.groupId] = group.activePaneIndex ?? 0;
      }
    }
    return { areas, activePaneIndexPerGroup };
  }

  private applyPageState(pageId: string): void {
    const defaults = this.getDefaultSettings();
    const state = this.pageStates[pageId];
    for (const name of ALL_PANE_AREA_NAMES) {
      const area = this.paneAreas[name];
      const saved = state?.areas?.[name];
      area.visible = saved?.visible ?? defaults[name].visible;
      area.sizeInPixels = saved?.sizeInPixels ?? defaults[name].sizeInPixels;
      this.lastActivePaneIdPerArea[name] = saved?.lastActivePaneId ?? null;

      const groups = area.paneGroups.filter((group) => this.isGroupOnPage(group, pageId));
      const activeGroup = groups.find((group) => group.groupId === saved?.activeGroupId) ?? groups[0];
      for (const group of groups) {
        group.visible = group === activeGroup;
        const savedIndex = state?.activePaneIndexPerGroup?.[group.groupId] ?? 0;
        group.activePaneIndex = savedIndex < group.panes.length ? savedIndex : 0;
      }
    }
  }

  /** Switches to the first page of the group that contains `paneId` when the active page does not show it. */
  private ensurePageOfPane(paneId: string): void {
    const { paneGroup } = this.getPaneAreaAndGroupContainingPane(paneId);
    const pages = this.pagesPerGroup.get(paneGroup.groupId);
    if (pages != null && pages.length > 0 && (this.activePageId == null || !pages.includes(this.activePageId))) {
      this.requestPageActivation(pages[0]);
    }
  }

  getPaneAreaVisibility(name: PaneAreaName): boolean {
    const paneArea: PaneAreaObject = this.paneAreas[name];

    return paneArea.visible;
  }

  togglePaneArea(name: PaneAreaName): void {
    this.setPaneAreaVisibility(name, !this.getPaneAreaVisibility(name));
  }

  showPaneArea(name: PaneAreaName): void {
    this.setPaneAreaVisibility(name, true);
  }

  hidePaneArea(name: PaneAreaName): void {
    this.setPaneAreaVisibility(name, false);
  }

  private setPaneAreaVisibility(name: PaneAreaName, visible: boolean): void {
    const paneArea: PaneAreaObject = this.paneAreas[name];
    paneArea.visible = visible;

    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  setPaneCollapsed(paneId: string, collapsed: boolean): void {
    const pane: PaneObject = this.getPaneObjectById(paneId);
    // PaneObject objects are read-only in user-space
    // DO NOT USE this "trick" without knowing the implications!
    (pane as any).collapsed = collapsed;

    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  setVisibilityOfPaneAreaByPaneId(paneId: string, visible: boolean): void {
    if (visible) {
      this.ensurePageOfPane(paneId);
    }
    const { paneArea, paneGroup } = this.getPaneAreaAndGroupContainingPane(paneId);
    const paneAreaName = this.getPaneAreaNameForObject(paneArea);

    if (visible) {
      paneArea.paneGroups.forEach((otherPaneGroup: PaneGroupObject) => {
        otherPaneGroup.visible = false;
      });

      paneGroup.visible = true;
      paneGroup.activePaneIndex = paneGroup.panes.findIndex((pane: PaneObject) => pane.id === paneId);

      if (paneAreaName != null) {
        this.lastActivePaneIdPerArea[paneAreaName] = paneId;
      }
    }

    paneArea.visible = visible;

    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  // TODO: the concept of pane groups with names/ids does not work well with draggable panes
  togglePaneAreaByPaneId(paneId: string): void {
    this.ensurePageOfPane(paneId);
    for (const paneAreaName of Object.keys(this.paneAreas)) {
      const paneArea: PaneAreaObject = this.paneAreas[paneAreaName as PaneAreaName];

      let requestedPaneFoundAndToggled = false;

      paneArea.paneGroups.forEach((paneGroup: PaneGroupObject) => {
        const requestedPaneIndex = paneGroup.panes.findIndex((pane: PaneObject) => pane.id === paneId);
        const requestedPaneFoundInGroup = requestedPaneIndex !== -1;

        if (requestedPaneFoundInGroup) {
          const alreadyDisplayingRequestedPane =
            paneArea.visible && paneGroup.visible && paneGroup.activePaneIndex === requestedPaneIndex;

          if (alreadyDisplayingRequestedPane) {
            paneArea.visible = false;
          } else {
            paneGroup.activePaneIndex = requestedPaneIndex;
            paneArea.visible = true;
          }
        }

        requestedPaneFoundAndToggled = requestedPaneFoundAndToggled || requestedPaneFoundInGroup;
      });

      if (requestedPaneFoundAndToggled) {
        this.emit(EVENT_PANE_LAYOUT_UPDATED);

        return;
      }
    }

    throw new Error(`Pane with id not found '${paneId}'.`);
  }

  getPaneAreaAndGroupContainingPane(paneId: string): PaneAreaAndGroup {
    for (const paneAreaName of Object.keys(this.paneAreas)) {
      const paneArea: PaneAreaObject = this.paneAreas[paneAreaName as PaneAreaName];

      for (const paneGroup of paneArea.paneGroups) {
        const requestedPaneIndex = paneGroup.panes.findIndex((pane: PaneObject) => pane.id === paneId);
        const requestedPaneFoundInGroup = requestedPaneIndex !== -1;

        if (requestedPaneFoundInGroup) {
          return { paneArea, paneGroup };
        }
      }
    }

    throw new Error(`Pane with id not found '${paneId}'.`);
  }

  alreadyRegistered(paneId: string): boolean {
    for (const paneAreaName of Object.keys(this.paneAreas)) {
      const paneArea: PaneAreaObject = this.paneAreas[paneAreaName as PaneAreaName];

      for (const paneGroup of paneArea.paneGroups) {
        const requestedPaneIndex = paneGroup.panes.findIndex((pane: PaneObject) => pane.id === paneId);
        const requestedPaneFoundInGroup = requestedPaneIndex !== -1;

        if (requestedPaneFoundInGroup) {
          return true;
        }
      }
    }

    return false;
  }

  registerPaneGroup(
    paneArea: PaneAreaName,
    paneGroupId: string,
    paneProviders: PaneObject[],
    options?: { label?: string; icon?: string | (() => string); pages?: string[] },
  ): void {
    const paneAreaObject: PaneAreaObject = this.paneAreas[paneArea];
    if (paneAreaObject == null) {
      throw new Error(`PaneArea with id not found '${paneArea}'.`);
    }
    if (paneArea === 'left' && (options?.pages == null || options.pages.length === 0)) {
      throw new Error(`The left pane group '${paneGroupId}' must name the pages it appears on ('pages').`);
    }

    this.pagesPerGroup.set(paneGroupId, options?.pages ?? null);
    const pages = options?.pages ?? null;
    const sharesPageWithExistingGroup = paneAreaObject.paneGroups.some((existing) => {
      const existingPages = this.pagesPerGroup.get(existing.groupId);
      return pages == null || existingPages == null || existingPages.some((page) => pages.includes(page));
    });
    const isFirstPaneGroupInArea = !sharesPageWithExistingGroup;

    paneAreaObject.paneGroups.push({
      groupId: paneGroupId,
      visible: isFirstPaneGroupInArea,
      panes: paneProviders,
      activePaneIndex: 0,
      label: options?.label,
      icon: options?.icon,
    });
  }

  unregisterPane(paneId: string): void {
    for (const areaName of ALL_PANE_AREA_NAMES) {
      const area = this.paneAreas[areaName];
      for (const group of area.paneGroups) {
        const index = group.panes.findIndex((pane) => pane.id === paneId);
        if (index !== -1) {
          group.panes.splice(index, 1);
          if (group.activePaneIndex != null && group.activePaneIndex >= group.panes.length) {
            group.activePaneIndex = Math.max(0, group.panes.length - 1);
          }
          this.emit(EVENT_PANE_LAYOUT_UPDATED);
          return;
        }
      }
    }
  }

  unregisterPaneGroup(paneGroupId: string): void {
    for (const areaName of ALL_PANE_AREA_NAMES) {
      const area = this.paneAreas[areaName];
      const index = area.paneGroups.findIndex((group) => group.groupId === paneGroupId);
      if (index !== -1) {
        area.paneGroups.splice(index, 1);
        this.pagesPerGroup.delete(paneGroupId);
        this.emit(EVENT_PANE_LAYOUT_UPDATED);
        return;
      }
    }
  }

  setActiveGroupInArea(area: PaneAreaName, groupId: string): void {
    const paneArea: PaneAreaObject = this.paneAreas[area];

    let found = false;
    for (const group of paneArea.paneGroups.filter((candidate) => this.isGroupOnPage(candidate, this.activePageId))) {
      if (group.groupId === groupId) {
        group.visible = true;
        found = true;
        this.lastActivePaneIdPerArea[area] = group.panes[group.activePaneIndex ?? 0]?.id ?? null;
      } else {
        group.visible = false;
      }
    }

    if (!found) {
      throw new Error(`PaneGroup '${groupId}' not found in area '${area}'.`);
    }

    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  requestPaneLayoutUpdate(): void {
    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  appendToPaneGroup(paneArea: PaneAreaName, paneGroupId: string, paneProviders: PaneObject[]): void {
    const paneGroup = this.getPaneGroupById(paneArea, paneGroupId);
    if (paneGroup == null) {
      throw new Error(this.getPaneGroupNotFoundErrorMessage(paneArea, paneGroupId));
    }

    paneGroup.panes = [...paneGroup.panes, ...paneProviders];
    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  prependToPaneGroup(paneArea: PaneAreaName, paneGroupId: string, paneProviders: PaneObject[]): void {
    const paneGroup = this.getPaneGroupById(paneArea, paneGroupId);
    if (paneGroup == null) {
      throw new Error(this.getPaneGroupNotFoundErrorMessage(paneArea, paneGroupId));
    }

    paneGroup.panes = [...paneProviders, ...paneGroup.panes];
    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  updatePaneAreaSize(paneAreaId: PaneAreaName, pixels: number): void {
    const paneArea = this.paneAreas[paneAreaId];
    if (paneArea == null) {
      throw new Error(`PaneArea with ID not found '${paneAreaId}'.`);
    }

    paneArea.sizeInPixels = pixels;

    this.emit(EVENT_PANE_SIZE_UPDATED);
  }

  setActivePane(paneArea: PaneAreaName, paneAreaIndex: number, activePaneIndex: number): void {
    const paneGroup: PaneGroupObject = this.getPaneGroupByIndex(paneArea, paneAreaIndex);

    this.setActivePaneInGroup(paneGroup, activePaneIndex);

    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  private setActivePaneInGroup(paneGroup: PaneGroupObject, activePaneIndex: number): void {
    if (activePaneIndex < 0 || activePaneIndex >= paneGroup.panes.length) {
      throw new Error(`activePaneIndex out of bounds: ${activePaneIndex}`);
    }

    paneGroup.activePaneIndex = activePaneIndex;
  }

  movePane(
    origPaneArea: PaneAreaName,
    origPaneAreaIndex: number,
    origIndex: number,
    destPaneArea: PaneAreaName,
    destPaneAreaIndex: number,
    destIndex: number,
  ): void {
    const origpaneGroup: PaneGroupObject = this.getPaneGroupByIndex(origPaneArea, origPaneAreaIndex);
    const destpaneGroup: PaneGroupObject = this.getPaneGroupByIndex(destPaneArea, destPaneAreaIndex);
    const itemToMove = origpaneGroup.panes[origIndex];

    if (origIndex < 0 || origIndex >= origpaneGroup.panes.length) {
      throw new Error(`origIndex out of bounds: ${origIndex}`);
    }
    if (destIndex < 0 || destIndex > destpaneGroup.panes.length) {
      throw new Error(`destIndex out of bounds: ${destIndex}`);
    }

    origpaneGroup.panes.splice(origIndex, 1);
    destpaneGroup.panes.splice(destIndex, 0, itemToMove);

    if (destpaneGroup.activePaneIndex != null) {
      destpaneGroup.activePaneIndex = destIndex;
    }

    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  getActivePaneIdForArea(area: PaneAreaName): string | null {
    const paneArea: PaneAreaObject = this.paneAreas[area];
    if (!paneArea.visible) {
      return null;
    }

    const visibleGroup = this.getGroupsOnActivePage(area).find((paneGroup) => paneGroup.visible);
    if (visibleGroup == null || visibleGroup.panes.length === 0) {
      return null;
    }

    const index = visibleGroup.activePaneIndex ?? 0;
    return visibleGroup.panes[index]?.id ?? null;
  }

  isPaneGroupVisibleByPaneId(paneId: string): boolean {
    try {
      const { paneArea, paneGroup } = this.getPaneAreaAndGroupContainingPane(paneId);
      return paneArea.visible && paneGroup.visible && this.isGroupOnPage(paneGroup, this.activePageId);
    } catch {
      return false;
    }
  }

  selectLastActivePaneInArea(area: PaneAreaName): void {
    const lastPaneId = this.lastActivePaneIdPerArea[area];
    if (lastPaneId == null || !this.alreadyRegistered(lastPaneId)) {
      this.showPaneArea(area);
      return;
    }

    this.setVisibilityOfPaneAreaByPaneId(lastPaneId, true);
  }

  reset(): void {
    const defaultSettings = this.getDefaultSettings();
    this.pageStates = {};
    this.paneAreas.left.visible = defaultSettings.left.visible;
    this.paneAreas.left.sizeInPixels = defaultSettings.left.sizeInPixels;
    this.paneAreas.right.visible = defaultSettings.right.visible;
    this.paneAreas.right.sizeInPixels = defaultSettings.right.sizeInPixels;
    this.paneAreas.bottom.visible = defaultSettings.bottom.visible;
    this.paneAreas.bottom.sizeInPixels = defaultSettings.bottom.sizeInPixels;

    this.emit(EVENT_PANE_LAYOUT_UPDATED);
  }

  private getPaneGroupById(paneAreaName: PaneAreaName, paneGroupId: string): PaneGroupObject | null {
    const paneArea: PaneAreaObject = this.paneAreas[paneAreaName];
    if (!paneArea) {
      throw new Error(`Unknown paneArea identifier: ${paneAreaName}`);
    }

    return paneArea.paneGroups.find((paneGroup: PaneGroupObject) => paneGroup.groupId === paneGroupId) || null;
  }

  private getPaneGroupByIndex(paneAreaName: PaneAreaName, paneAreaGroupIndex: number): PaneGroupObject {
    const paneArea: PaneAreaObject = this.paneAreas[paneAreaName];
    if (paneArea == null) {
      throw new Error(`Unknown paneArea identifier: ${paneAreaName}`);
    }
    const groupsOnPage = this.getGroupsOnActivePage(paneAreaName);
    if (paneAreaGroupIndex < 0 || paneAreaGroupIndex >= groupsOnPage.length) {
      throw new Error(`paneAreaIndex out of bounds: ${paneAreaName}`);
    }
    return groupsOnPage[paneAreaGroupIndex];
  }

  private getPaneGroupNotFoundErrorMessage(paneArea: PaneAreaName, paneGroupId: string): string {
    const otherPaneAreaNames: PaneAreaName[] = ALL_PANE_AREA_NAMES.filter(
      (paneArea2: string) => paneArea !== paneArea2,
    );
    const paneAreaContainingGroup = otherPaneAreaNames.find((otherPaneArea: PaneAreaName) =>
      this.paneAreas[otherPaneArea].paneGroups.find((paneGroup: PaneGroupObject) => paneGroup.groupId === paneGroupId),
    );
    const msg = paneAreaContainingGroup == null ? 'or any other area' : `found in '${paneAreaContainingGroup}' instead`;
    return `PaneGroup with id '${paneGroupId}' not found in area '${paneArea}' (${msg}).`;
  }

  private getPaneAreaNameForObject(paneArea: PaneAreaObject): PaneAreaName | null {
    for (const name of ALL_PANE_AREA_NAMES) {
      if (this.paneAreas[name] === paneArea) {
        return name;
      }
    }
    return null;
  }

  private getPaneObjectById(paneId: string): PaneObject {
    for (const paneAreaName of Object.keys(this.paneAreas)) {
      const paneArea: PaneAreaObject = this.paneAreas[paneAreaName as PaneAreaName];

      for (const paneGroup of paneArea.paneGroups) {
        const requestedPane = paneGroup.panes.find((pane: PaneObject) => pane.id === paneId);

        if (requestedPane != null) {
          return requestedPane;
        }
      }
    }

    throw new Error(`Could not find PaneObject with id: ${paneId}`);
  }

  private getDefaultSettings(): PaneAreas {
    return {
      left: {
        visible: true,
        sizeInPixels: 270,
        paneGroups: [],
      },
      right: {
        visible: true,
        sizeInPixels: 270,
        paneGroups: [],
      },
      bottom: {
        visible: false,
        sizeInPixels: 30,
        paneGroups: [],
      },
    };
  }
}
