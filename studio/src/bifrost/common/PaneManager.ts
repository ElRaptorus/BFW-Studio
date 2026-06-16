import type {
  PaneAreaAndGroup,
  PaneAreaName,
  PaneAreaObject,
  PaneAreasSerialized,
  PaneGroupObject,
  PaneObject,
} from '@evil/bifrost_fw_sdk';
import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import {
  EVENT_PANE_LAYOUT_UPDATED,
  EVENT_PANE_SIZE_UPDATED,
} from '../../../../studio-sdk/src/contracts/internal/PaneEvents';
import type { ISerializable } from '../contracts/SerializableTypes';

const ALL_PANE_AREA_NAMES: PaneAreaName[] = ['left', 'bottom', 'right'];

type PaneAreas = {
  readonly left: PaneAreaObject;
  readonly right: PaneAreaObject;
  readonly bottom: PaneAreaObject;
};

type PaneManagerSerialized = PaneAreasSerialized & {
  lastActivePaneIdPerArea?: Record<PaneAreaName, string | null>;
};

export class PaneManager extends AbstractEmitter implements ISerializable {
  private paneAreas: PaneAreas;
  private lastActivePaneIdPerArea: Record<PaneAreaName, string | null>;

  constructor() {
    super();

    this.paneAreas = this.getDefaultSettings();
    this.lastActivePaneIdPerArea = { left: null, bottom: null, right: null };
  }

  deserialize(dump: any): void {
    if (dump == null) {
      return;
    }

    const deepCopy = JSON.parse(JSON.stringify(dump));

    // TODO: we have to "merge" the saved state and the initialized one
    // e.g. we can not render panes of which we no longer know the provider
    // this.paneAreaMap = deepCopy;
    this.paneAreas.left.visible = deepCopy.left.visible;
    this.paneAreas.left.sizeInPixels = deepCopy.left.sizeInPixels;

    this.paneAreas.bottom.visible = deepCopy.bottom.visible;
    this.paneAreas.bottom.sizeInPixels = deepCopy.bottom.sizeInPixels;
    this.paneAreas.bottom.paneGroups.forEach((paneGroup: PaneGroupObject) => {
      const restoredPaneGroup = deepCopy.bottom.paneGroups.find(
        (restoredPaneGroup: any) => paneGroup.groupId === restoredPaneGroup.groupId,
      );
      if (restoredPaneGroup == null) {
        return;
      }

      // TODO: store the paneId of the active pane instead of the index to improve restore stability
      try {
        this.setActivePaneInGroup(paneGroup, restoredPaneGroup.activePaneIndex);
      } catch (error) {
        console.error('Error while restoring panes: ', error);
      }
    });

    // Restore which group was active in the bottom area
    const savedBottomActiveGroupId = deepCopy.bottom.paneGroups.find(
      (group: PaneGroupObject) => group.visible,
    )?.groupId;
    if (savedBottomActiveGroupId != null) {
      const matchingGroup = this.paneAreas.bottom.paneGroups.find(
        (group) => group.groupId === savedBottomActiveGroupId,
      );
      if (matchingGroup != null) {
        for (const group of this.paneAreas.bottom.paneGroups) {
          group.visible = group.groupId === savedBottomActiveGroupId;
        }
      }
    }

    const restorePaneArea = (paneArea: PaneAreaObject, deepCopyPaneArea: PaneAreaObject): void => {
      paneArea.paneGroups.forEach((actualGroup) => {
        const groupFromBackup = deepCopyPaneArea.paneGroups.find((group) => group.groupId === actualGroup.groupId);
        if (!groupFromBackup) {
          return;
        }

        actualGroup.panes.forEach((actualPane) => {
          const paneFromBackup = groupFromBackup.panes.find((pane) => pane.id === actualPane.id);
          if (!paneFromBackup) {
            return;
          }

          (actualPane as any).collapsed = paneFromBackup.collapsed;
        });

        const savedIndex = groupFromBackup.activePaneIndex ?? 0;
        const savedPaneId = groupFromBackup.panes[savedIndex]?.id;
        if (savedPaneId != null) {
          const currentIndex = actualGroup.panes.findIndex((pane) => pane.id === savedPaneId);
          if (currentIndex !== -1) {
            try {
              this.setActivePaneInGroup(actualGroup, currentIndex);
            } catch (error) {
              console.error('Error while restoring active pane:', error);
            }
          }
        }
      });

      const savedActiveGroupId = deepCopyPaneArea.paneGroups.find((group: PaneGroupObject) => group.visible)?.groupId;

      if (savedActiveGroupId != null) {
        const matchingGroup = paneArea.paneGroups.find((group) => group.groupId === savedActiveGroupId);
        if (matchingGroup != null) {
          for (const group of paneArea.paneGroups) {
            group.visible = group.groupId === savedActiveGroupId;
          }
        }
      }
    };

    restorePaneArea(this.paneAreas.left, deepCopy.left);
    restorePaneArea(this.paneAreas.right, deepCopy.right);

    this.paneAreas.right.visible = deepCopy.right.visible;
    this.paneAreas.right.sizeInPixels = deepCopy.right.sizeInPixels;

    if (deepCopy.lastActivePaneIdPerArea != null) {
      this.lastActivePaneIdPerArea = { ...this.lastActivePaneIdPerArea, ...deepCopy.lastActivePaneIdPerArea };
    }
  }

  serialize(): PaneManagerSerialized {
    return {
      ...this.paneAreas,
      lastActivePaneIdPerArea: this.lastActivePaneIdPerArea,
    };
  }

  getViewData(): PaneAreasSerialized {
    return this.paneAreas;
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
    options?: { label?: string; icon?: string | (() => string) },
  ): void {
    const paneAreaObject: PaneAreaObject = this.paneAreas[paneArea];
    if (paneAreaObject == null) {
      throw new Error(`PaneArea with id not found '${paneArea}'.`);
    }

    const isFirstPaneGroupInArea = paneAreaObject.paneGroups.length === 0;

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
        this.emit(EVENT_PANE_LAYOUT_UPDATED);
        return;
      }
    }
  }

  setActiveGroupInArea(area: PaneAreaName, groupId: string): void {
    const paneArea: PaneAreaObject = this.paneAreas[area];

    let found = false;
    for (const group of paneArea.paneGroups) {
      if (group.groupId === groupId) {
        group.visible = true;
        found = true;
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

    const visibleGroup = paneArea.paneGroups.find((paneGroup) => paneGroup.visible);
    if (visibleGroup == null || visibleGroup.panes.length === 0) {
      return null;
    }

    const index = visibleGroup.activePaneIndex ?? 0;
    return visibleGroup.panes[index]?.id ?? null;
  }

  isPaneGroupVisibleByPaneId(paneId: string): boolean {
    try {
      const { paneArea, paneGroup } = this.getPaneAreaAndGroupContainingPane(paneId);
      return paneArea.visible && paneGroup.visible;
    } catch {
      return false;
    }
  }

  selectLastActivePaneInArea(area: PaneAreaName): void {
    const lastPaneId = this.lastActivePaneIdPerArea[area];
    if (lastPaneId == null) {
      this.showPaneArea(area);
      return;
    }

    this.setVisibilityOfPaneAreaByPaneId(lastPaneId, true);
  }

  reset(): void {
    const defaultSettings = this.getDefaultSettings();
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
    if (paneAreaGroupIndex < 0 || paneAreaGroupIndex >= paneArea.paneGroups.length) {
      throw new Error(`paneAreaIndex out of bounds: ${paneAreaName}`);
    }
    return paneArea.paneGroups[paneAreaGroupIndex];
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
