import type { SolutionBpmnModelEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';

import type { LandscapeMap } from './LandscapeMapFile';
import { createElementId, createEmptyLandscapeMap, relativeFileHint } from './LandscapeMapFile';
import type { LandscapeProcessReference, ProcessRelation } from './buildProcessRelations';
import { layoutLandscape, PROCESS_SHAPE_HEIGHT, PROCESS_SHAPE_WIDTH } from './layoutLandscape';

export type NewMapGrouping = 'none' | 'folder' | 'file';

export type CreateLandscapeMapRequest = {
  catalog: SolutionBpmnModelEntry[];
  relations: ProcessRelation[];
  /** The processes the user selected. */
  seeds: LandscapeProcessReference[];
  /** How many relation steps around the seeds are added, in both directions and over every kind of relation. */
  neighbourSteps: number;
  grouping: NewMapGrouping;
  /** Rows by call depth; otherwise every kind of relation shapes the layout. */
  callHierarchy: boolean;
  name: string;
  /** Where the map will be saved; the `fileHint` of every process is relative to it. */
  mapUri: string;
};

const LEVEL_NAME_BY_GROUPING = { folder: 'Folder', file: 'File' } as const;

const lastSegmentOf = (uri: string): string => decodeURIComponent(uri.split('/').pop() ?? uri);
const folderOf = (uri: string): string => uri.slice(0, uri.lastIndexOf('/'));

/**
 * The processes of the map: the seeds, plus everything within `neighbourSteps` relations of them. A process id shows
 * once; the file of a seed wins, else the file the first relation to it names.
 */
function selectProcesses(request: CreateLandscapeMapRequest): LandscapeProcessReference[] {
  const definedIds = new Set(
    request.catalog.flatMap((entry) => (entry.kind === 'bpmn' ? entry.processes.map((process) => process.id) : [])),
  );
  const selected = new Map<string, LandscapeProcessReference>();
  for (const seed of request.seeds) {
    if (definedIds.has(seed.processId) && !selected.has(seed.processId)) {
      selected.set(seed.processId, seed);
    }
  }
  let frontier = new Set(selected.keys());
  for (let step = 0; step < request.neighbourSteps; step++) {
    const reached = new Set<string>();
    for (const relation of request.relations) {
      for (const [from, to] of [
        [relation.source, relation.target],
        [relation.target, relation.source],
      ] as const) {
        if (frontier.has(from.processId) && !selected.has(to.processId)) {
          selected.set(to.processId, to);
          reached.add(to.processId);
        }
      }
    }
    frontier = reached;
  }
  return [...selected.values()];
}

function groupOf(
  reference: LandscapeProcessReference,
  grouping: NewMapGrouping,
): { groupKey: string | null; groupLabel: string | null } {
  if (grouping === 'none') {
    return { groupKey: null, groupLabel: null };
  }
  const groupKey = grouping === 'file' ? reference.uri : folderOf(reference.uri);
  return { groupKey, groupLabel: lastSegmentOf(groupKey) };
}

/** A new map that shows the selected processes and their neighbours, laid out by `layoutLandscape`. */
export async function createLandscapeMap(request: CreateLandscapeMapRequest): Promise<LandscapeMap> {
  const processes = selectProcesses(request);
  const selectedIds = new Set(processes.map((process) => process.processId));
  const layoutNodes = processes.map((process) => ({ key: process.processId, ...groupOf(process, request.grouping) }));
  const layout = await layoutLandscape({
    nodes: layoutNodes,
    edges: request.relations
      .filter((relation) => selectedIds.has(relation.source.processId) && selectedIds.has(relation.target.processId))
      .map((relation) => ({
        sourceKey: relation.source.processId,
        targetKey: relation.target.processId,
        kind: relation.kind,
      })),
    options: { callHierarchy: request.callHierarchy },
  });

  const map = createEmptyLandscapeMap(request.name);
  const takenIds = new Set<string>();
  const newId = (type: Parameters<typeof createElementId>[0]): string => {
    const id = createElementId(type, (candidate) => takenIds.has(candidate));
    takenIds.add(id);
    return id;
  };
  if (request.grouping !== 'none') {
    map.levels.push({ id: newId('level'), name: LEVEL_NAME_BY_GROUPING[request.grouping] });
  }

  const groupIdByKey = new Map<string, string>();
  for (const group of layout.groups) {
    const id = newId('group');
    groupIdByKey.set(group.key, id);
    map.elements.push({
      type: 'group',
      id,
      parentId: null,
      x: Math.round(group.x),
      y: Math.round(group.y),
      width: Math.round(group.width),
      height: Math.round(group.height),
      style: null,
      label: group.label,
      collapsed: false,
    });
  }
  for (const [index, process] of processes.entries()) {
    const position = layout.nodes.get(process.processId);
    if (position == null) {
      throw new Error(`The layout has no position for the process "${process.processId}".`);
    }
    const { groupKey } = layoutNodes[index]!;
    map.elements.push({
      type: 'process',
      id: newId('process'),
      parentId: groupKey == null ? null : (groupIdByKey.get(groupKey) ?? null),
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: PROCESS_SHAPE_WIDTH,
      height: PROCESS_SHAPE_HEIGHT,
      style: null,
      processId: process.processId,
      fileHint: relativeFileHint(request.mapUri, process.uri),
      label: null,
      shape: 'box',
    });
  }
  return map;
}
