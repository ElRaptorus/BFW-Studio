import { AbstractEmitter, assertNotNull } from '@evil/bifrost_fw_sdk';

import BpmnDiffingWorkerClient from './BpmnDiffingWorkerClient';
import { LAYOUT_CHANGE_REJECTED_TYPES } from './bpmnDiffConstants';

export type BpmnDiffChangesById = { [elementId: string]: BpmnDiffChange[] };

export type BpmnDiffChangesByAction = {
  added: BpmnDiffChangesById;
  moved: BpmnDiffChangesById;
  updated: BpmnDiffChangesById;
  deleted: BpmnDiffChangesById;
};

type BpmnDiffChange = any;

export class BpmnDiff extends AbstractEmitter {
  public changes: BpmnDiffChangesByAction | null;
  public changesById: BpmnDiffChangesById | null;
  public beforeXml: string;
  public afterXml: string;

  private changesRejecter: any;

  constructor(beforeXml: string, afterXml: string) {
    super();

    this.beforeXml = beforeXml;
    this.afterXml = afterXml;

    this.changes = null;
    this.changesById = null;

    this.changesRejecter = {
      moved: {
        $type: LAYOUT_CHANGE_REJECTED_TYPES,
      },
    };
  }

  async diff(): Promise<BpmnDiffChangesByAction> {
    const diffingClient = new BpmnDiffingWorkerClient();
    const diffResult = await diffingClient.diff(this.beforeXml, this.afterXml);
    const { _added, _changed, _layoutChanged, _removed } = diffResult;

    const added = this.convertChanges(_added, 'added');
    const moved = this.convertChanges(_layoutChanged, 'moved');
    const updated = this.convertChanges(_changed, 'updated');
    const deleted = this.convertChanges(_removed, 'deleted');

    const changes: BpmnDiffChangesByAction = {
      added: this.rejectChanges(added, this.changesRejecter.added),
      moved: this.rejectChanges(moved, this.changesRejecter.moved),
      updated: this.rejectChanges(updated, this.changesRejecter.updated),
      deleted: this.rejectChanges(deleted, this.changesRejecter.deleted),
    };

    const addedChanges = Object.values(changes.added ?? {});
    const movedChanges = Object.values(changes.moved ?? {});
    const updatedChanges = Object.values(changes.updated ?? {});
    const deletedChanges = Object.values(changes.deleted ?? {});

    const allChangesAsArray: any[] = [...addedChanges, ...movedChanges, ...updatedChanges, ...deletedChanges];

    const allChangesById: BpmnDiffChangesById = {};
    for (const change of allChangesAsArray) {
      if (allChangesById[change.id] == null) {
        allChangesById[change.id] = [];
      }
      allChangesById[change.id].push(change);
    }

    this.changes = changes;
    this.changesById = allChangesById;

    return this.changes;
  }

  getChanges(): BpmnDiffChangesByAction {
    assertNotNull(this.changes, 'this.changes');

    return this.changes;
  }

  getChangesById(elementId: string): any[] {
    if (this.changesById == null) {
      return [];
    }

    return this.changesById[elementId];
  }

  getAllChangesById(): BpmnDiffChangesById {
    if (this.changesById == null) {
      return {};
    }

    return this.changesById;
  }

  getAllChangedElementIds(): string[] {
    const allChangesById = this.getAllChangesById();

    return allChangesById == null ? [] : Object.keys(allChangesById);
  }

  private convertChanges(changes: any, action: string): any {
    const result: any = {};

    for (const id of Object.keys(changes)) {
      const change = changes[id];
      const model = change.model ?? change;
      const $type = model.$type;

      result[id] = { id, action, $type, change };
    }

    return result;
  }

  private rejectChanges(changesMap: any, rejecterMap: any): any {
    if (rejecterMap == null) {
      return changesMap;
    }

    const result: any = {};

    for (const id of Object.keys(changesMap)) {
      const change = changesMap[id];
      const rejectRegex = rejecterMap.$type;

      if (rejectRegex == null || change.$type == null || change.$type.match(rejectRegex) == null) {
        result[id] = change;
      }
    }

    return result;
  }
}
