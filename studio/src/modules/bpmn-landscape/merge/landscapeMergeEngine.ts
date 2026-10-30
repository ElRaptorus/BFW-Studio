import type { ConflictKey, ElementResolutionStatus, MergeOperationKind } from '#bifrost/contracts/MergeTypes';

import type { LandscapeConnector, LandscapeElement, LandscapeLevel, LandscapeMap } from '../LandscapeMapFile';
import { createEmptyLandscapeMap, parseLandscapeMap, serializeLandscapeMap } from '../LandscapeMapFile';

/** The conflict key of the map-level properties: name, relation layers, hidden relations and extensions. */
export const MAP_PROPERTIES_KEY = '$map';

export type LandscapeMergeResult = {
  map: LandscapeMap;
  /** Every item that is a conflict in this result, resolved or not, in map order. */
  conflicts: ConflictKey[];
  /** Items with an apply-side change the starting side lacks, merged without a conflict and not reverted. */
  autoApplied: ConflictKey[];
  /** Why the result cannot be written; `null` when it reads back as a valid map. */
  invalidReason: string | null;
};

type Property = { value: unknown; comparable: string };
/** One item as a property table; bounds or waypoints are one property, `LAYOUT`. */
type Flat = Map<string, Property>;
type Collection = 'elements' | 'connectors' | 'levels' | 'map';
type Item = {
  key: ConflictKey;
  collection: Collection;
  base?: Flat;
  starting?: Flat;
  apply?: Flat;
  applyChanged: boolean;
  /** The state the result holds; `undefined` when the item is not in the result. */
  state?: Flat;
};

const LAYOUT = '$layout';
const HIDDEN_RELATION_PREFIX = 'hiddenRelations.';

const sortedKeys = (_key: string, value: unknown): unknown =>
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([first], [second]) => first.localeCompare(second)))
    : value;

const property = (value: unknown, comparable = String(JSON.stringify(value, sortedKeys))): Property => ({
  value,
  comparable,
});
const ABSENT = property(undefined);

const contentOf = (item: object): [string, Property][] =>
  Object.entries(item)
    .filter(([key]) => key !== 'id')
    .map(([key, value]) => [key, property(value)]);

const valuesOf = (flat: Flat): Record<string, any> =>
  Object.fromEntries([...flat].flatMap(([key, entry]) => (entry.value === undefined ? [] : [[key, entry.value]])));

function flattenElement({ x, y, width, height, style, ...content }: LandscapeElement): Flat {
  return new Map([
    ...contentOf(content),
    ['style.fill', property(style?.fill ?? null)],
    ['style.stroke', property(style?.stroke ?? null)],
    [LAYOUT, property([x, y, width, height])],
  ]);
}

function unflattenElement(id: string, flat: Flat): LandscapeElement {
  const { [LAYOUT]: layout, 'style.fill': fill, 'style.stroke': stroke, ...content } = valuesOf(flat);
  const [x, y, width, height] = layout;
  const style = fill == null && stroke == null ? null : { fill, stroke };
  return { ...content, id, x, y, width, height, style } as LandscapeElement;
}

function flattenConnector({ waypoints, ...content }: LandscapeConnector): Flat {
  return new Map([...contentOf(content), [LAYOUT, property(waypoints)]]);
}

function unflattenConnector(id: string, flat: Flat): LandscapeConnector {
  const { [LAYOUT]: waypoints, ...content } = valuesOf(flat);
  return { ...content, id, waypoints } as LandscapeConnector;
}

/** Each hidden relation is a property of its own, so both sides can hide and show relations without a conflict. */
function flattenMapProperties(map: LandscapeMap): Flat {
  return new Map([
    ['name', property(map.name)],
    ...Object.entries(map.relationLayers).map(([kind, visible]): [string, Property] => [
      `relationLayers.${kind}`,
      property(visible),
    ]),
    ...map.hiddenRelations.map((key): [string, Property] => [`${HIDDEN_RELATION_PREFIX}${key}`, property(true)]),
    ['extensions.attributes', property(map.extensions.attributes)],
    [
      'extensions.elements',
      property(
        map.extensions.elements,
        serializeLandscapeMap({
          ...createEmptyLandscapeMap(''),
          extensions: { attributes: {}, elements: map.extensions.elements },
        }),
      ),
    ],
  ]);
}

function unflattenMapProperties(flat: Flat): Omit<LandscapeMap, 'levels' | 'elements' | 'connectors'> {
  const values = valuesOf(flat);
  return {
    name: values.name,
    relationLayers: {
      callActivity: values['relationLayers.callActivity'],
      message: values['relationLayers.message'],
      signal: values['relationLayers.signal'],
    },
    hiddenRelations: Object.keys(values)
      .filter((key) => key.startsWith(HIDDEN_RELATION_PREFIX))
      .map((key) => key.slice(HIDDEN_RELATION_PREFIX.length)),
    extensions: { attributes: values['extensions.attributes'], elements: values['extensions.elements'] },
  };
}

function sameState(first: Flat | undefined, second: Flat | undefined): boolean {
  if (first == null || second == null) {
    return first === second;
  }
  return [...new Set([...first.keys(), ...second.keys()])].every(
    (key) => (first.get(key) ?? ABSENT).comparable === (second.get(key) ?? ABSENT).comparable,
  );
}

/** Rule (c): each property merges on its own; `null` when both sides set one property to different values. */
function mergeProperties(base: Flat, starting: Flat, apply: Flat): Flat | null {
  const merged: Flat = new Map();
  for (const key of new Set([...starting.keys(), ...apply.keys(), ...base.keys()])) {
    const [baseProperty, startingProperty, applyProperty] = [base, starting, apply].map(
      (flat) => flat.get(key) ?? ABSENT,
    );
    if (
      applyProperty.comparable === baseProperty.comparable ||
      applyProperty.comparable === startingProperty.comparable
    ) {
      merged.set(key, startingProperty);
    } else if (startingProperty.comparable === baseProperty.comparable) {
      merged.set(key, applyProperty);
    } else {
      return null;
    }
  }
  return merged;
}

/** Rules (b) to (d) for one item; a conflict keeps the starting side until it is resolved. */
function mergeItem(item: Item): boolean {
  const { base, starting, apply } = item;
  item.applyChanged = !sameState(base, apply);
  item.state = starting;
  if (!item.applyChanged || sameState(starting, apply)) {
    return false;
  }
  if (sameState(base, starting)) {
    item.state = apply;
    return false;
  }
  if (base == null || starting == null || apply == null) {
    return true;
  }
  const merged = mergeProperties(base, starting, apply);
  if (merged == null) {
    return true;
  }
  item.state = merged;
  return false;
}

/** Items in starting-side order, then the apply side's additions, then the base side's. */
function collectItems(base: LandscapeMap, startingSide: LandscapeMap, applySide: LandscapeMap): Item[] {
  const items = new Map<string, Item>();
  const sides = [
    ['starting', startingSide],
    ['apply', applySide],
    ['base', base],
  ] as const;
  for (const [side, map] of sides) {
    const add = (collection: Collection, key: string, flat: Flat): void => {
      const slot = `${collection}:${key}`;
      const item = items.get(slot) ?? { key, collection, applyChanged: false };
      item[side] = flat;
      items.set(slot, item);
    };
    map.elements.forEach((element) => add('elements', element.id, flattenElement(element)));
    map.connectors.forEach((connector) => add('connectors', connector.id, flattenConnector(connector)));
    map.levels.forEach((level) => add('levels', level.id, new Map(contentOf(level))));
    add('map', MAP_PROPERTIES_KEY, flattenMapProperties(map));
  }
  return [...items.values()];
}

const valueOf = (item: Item, key: string): any => item.state?.get(key)?.value;

/**
 * Rule (e): every item of the tentative result that breaks a reader invariant, with the reason. An element that one
 * side removed while the result still refers to it (as parent or connector endpoint) is listed with the referrer.
 */
function findInvariantViolations(items: Item[]): Map<Item, string> {
  const violations = new Map<Item, string>();
  const elements = items.filter((item) => item.collection === 'elements' && item.state != null);
  const elementsById = new Map(elements.map((item) => [item.key, item]));
  const isContainer = (id: string): boolean => ['band', 'group'].includes(valueOf(elementsById.get(id)!, 'type'));
  const removedById = new Map(
    items
      .filter(
        (item) =>
          item.collection === 'elements' &&
          item.state == null &&
          item.base != null &&
          (item.starting == null || item.apply == null),
      )
      .map((item) => [item.key, item]),
  );
  const flag = (item: Item, reason: string, referencedId: string): void => {
    violations.set(item, reason);
    const removed = removedById.get(referencedId);
    if (removed != null) {
      violations.set(removed, reason);
    }
  };

  for (const element of elements) {
    const parentId: string | null = valueOf(element, 'parentId');
    if (parentId == null) {
      continue;
    }
    if (valueOf(element, 'type') === 'band') {
      violations.set(element, `Band '${element.key}' is inside '${parentId}'; bands stay at the top level.`);
    } else if (!elementsById.has(parentId) || !isContainer(parentId)) {
      flag(
        element,
        `Element '${element.key}' is inside '${parentId}', which is not a band or group of the merged map.`,
        parentId,
      );
    } else {
      const visited = new Set<string>();
      for (
        let ancestorId: string | null = parentId;
        ancestorId != null;
        ancestorId = valueOf(elementsById.get(ancestorId)!, 'parentId')
      ) {
        if (ancestorId === element.key) {
          violations.set(element, `Element '${element.key}' is nested inside itself.`);
          break;
        }
        if (visited.has(ancestorId) || !elementsById.has(ancestorId)) {
          break;
        }
        visited.add(ancestorId);
      }
    }
  }

  const holdersByProcessId = new Map<string, Item[]>();
  for (const element of elements.filter((item) => valueOf(item, 'type') === 'process')) {
    const processId: string = valueOf(element, 'processId');
    holdersByProcessId.set(processId, [...(holdersByProcessId.get(processId) ?? []), element]);
  }
  for (const [processId, holders] of holdersByProcessId) {
    if (holders.length < 2) {
      continue;
    }
    const keeper =
      holders.find(
        (holder) =>
          holder.starting?.get('type')?.value === 'process' && holder.starting.get('processId')?.value === processId,
      ) ?? holders[0];
    for (const holder of holders.filter((candidate) => candidate !== keeper)) {
      violations.set(holder, `The process '${processId}' appears more than once; a map shows a process once.`);
    }
  }

  for (const connector of items.filter((item) => item.collection === 'connectors' && item.state != null)) {
    const missing = [valueOf(connector, 'sourceId'), valueOf(connector, 'targetId')].find(
      (endpoint) => !elementsById.has(endpoint),
    );
    if (missing != null) {
      flag(connector, `Connector '${connector.key}' points to '${missing}', which is not on the merged map.`, missing);
    }
  }
  return violations;
}

/** Parents before their children, as the canvas import needs them; siblings keep their order. */
function depthFirst(elements: LandscapeElement[]): LandscapeElement[] {
  const containerIds = new Set(
    elements.flatMap((element) => (element.type === 'band' || element.type === 'group' ? [element.id] : [])),
  );
  const childrenByParentId = new Map<string | null, LandscapeElement[]>();
  for (const element of elements) {
    const parentId = element.parentId != null && containerIds.has(element.parentId) ? element.parentId : null;
    childrenByParentId.set(parentId, [...(childrenByParentId.get(parentId) ?? []), element]);
  }
  const ordered: LandscapeElement[] = [];
  const visit = (parentId: string | null): void => {
    for (const child of childrenByParentId.get(parentId) ?? []) {
      ordered.push(child);
      if (containerIds.has(child.id)) {
        visit(child.id);
      }
    }
  };
  visit(null);
  const placed = new Set(ordered);
  return [...ordered, ...elements.filter((element) => !placed.has(element))];
}

/**
 * Rule (g).
 *
 * ponytail: sibling order is not merged; the starting side's order wins and the apply side's additions go after the
 * existing children of their parent, so a z-order change on the apply side is lost. Merge the sibling sequences if
 * that matters.
 */
function buildMap(items: Item[]): LandscapeMap {
  const present = (collection: Collection): Item[] =>
    items.filter((item) => item.collection === collection && item.state != null);
  const mapItem = items.find((item) => item.collection === 'map')!;
  return {
    ...unflattenMapProperties(mapItem.state!),
    levels: present('levels').map(
      (item): LandscapeLevel => ({ ...valuesOf(item.state!), id: item.key }) as LandscapeLevel,
    ),
    elements: depthFirst(present('elements').map((item) => unflattenElement(item.key, item.state!))),
    connectors: present('connectors').map((item) => unflattenConnector(item.key, item.state!)),
  };
}

/**
 * Three-way merge of two landscape maps, item by item. Items are elements, connectors and levels matched by id, and
 * the map-level properties as the item `$map`.
 *
 * The engine works on the starting side (the version the merge starts from) and the apply side (the version merged
 * into it). `accepted-ours` takes the starting side unless `operationKind` is `rebase`, where git's "ours" is the
 * apply side. `reverted` puts an auto-applied item back to its starting-side state.
 */
export async function mergeLandscapeMaps(
  base: LandscapeMap,
  startingSide: LandscapeMap,
  applySide: LandscapeMap,
  resolutions: ReadonlyMap<ConflictKey, ElementResolutionStatus>,
  operationKind: MergeOperationKind = null,
): Promise<LandscapeMergeResult> {
  const applyStatus: ElementResolutionStatus = operationKind === 'rebase' ? 'accepted-ours' : 'accepted-theirs';
  const isResolved = (item: Item): boolean => {
    const status = resolutions.get(item.key);
    return status === 'accepted-ours' || status === 'accepted-theirs';
  };
  /** Rule (f): a resolved conflict takes the chosen side's whole item; an open one keeps the starting side. */
  const settle = (item: Item): void => {
    item.state = resolutions.get(item.key) === applyStatus ? item.apply : item.starting;
  };

  const items = collectItems(base, startingSide, applySide);
  const conflicts = new Set(items.filter(mergeItem));
  conflicts.forEach(settle);
  for (const item of items) {
    if (!conflicts.has(item) && item.applyChanged && resolutions.get(item.key) === 'reverted') {
      item.state = item.starting;
    }
  }

  // An open conflict that still breaks an invariant falls back to its starting side, then leaves the result.
  for (let changed = true; changed;) {
    changed = false;
    for (const item of findInvariantViolations(items).keys()) {
      if (!conflicts.has(item)) {
        conflicts.add(item);
        settle(item);
        changed = true;
      } else if (isResolved(item) || item.state == null) {
        continue;
      } else if (item.state !== item.starting) {
        item.state = item.starting;
        changed = true;
      } else {
        item.state = undefined;
        changed = true;
      }
    }
  }

  const map = buildMap(items);
  const problems = [...new Set(findInvariantViolations(items).values())];
  if (problems.length === 0) {
    const readBack = await parseLandscapeMap(serializeLandscapeMap(map));
    if (!readBack.ok) {
      problems.push(...readBack.errors);
    }
  }
  return {
    map,
    conflicts: items.filter((item) => conflicts.has(item)).map((item) => item.key),
    autoApplied: items
      .filter(
        (item) =>
          item.applyChanged &&
          !sameState(item.starting, item.apply) &&
          !conflicts.has(item) &&
          resolutions.get(item.key) !== 'reverted',
      )
      .map((item) => item.key),
    invalidReason: problems.length === 0 ? null : problems.join('\n'),
  };
}
