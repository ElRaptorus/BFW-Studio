import type { ELK, ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import ElkEngine from 'elkjs/lib/elk-api';

import type { ProcessRelationKind } from './buildProcessRelations';

/** The size of a process shape on a map. */
export const PROCESS_SHAPE_WIDTH = 140;
export const PROCESS_SHAPE_HEIGHT = 60;

/** The space a group keeps free above its processes for its label, plus the inset on the other sides. */
const GROUP_PADDING = { top: 60, left: 20, bottom: 20, right: 20 };
const LAYOUT_TIMEOUT_MILLISECONDS = 30_000;

export type LandscapeLayoutNode = {
  key: string;
  /** The group the node sits in; `null` for a node outside every group. */
  groupKey: string | null;
  /** The group's label; the same for every node of one group. */
  groupLabel: string | null;
};

export type LandscapeLayoutEdge = { sourceKey: string; targetKey: string; kind: ProcessRelationKind };

export type LandscapeLayoutInput = {
  nodes: LandscapeLayoutNode[];
  edges: LandscapeLayoutEdge[];
  options: {
    /** Rows by call depth: only call edges shape the layout. Otherwise every kind of edge does. */
    callHierarchy: boolean;
  };
};

export type LandscapeLayout = {
  /** The top-left corner of every node, in map coordinates. */
  nodes: Map<string, { x: number; y: number }>;
  groups: { key: string; label: string; x: number; y: number; width: number; height: number }[];
};

type Engine = { elk: ELK; failure: Promise<never> };

let engine: Engine | null = null;

/** Started on first use: the algorithm lives in a 1.6 MB worker script that is copied to `out/` unchanged. */
function getEngine(): Engine {
  if (engine != null) {
    return engine;
  }
  let reportFailure: (error: Error) => void = () => undefined;
  const failure = new Promise<never>((_resolve, reject) => (reportFailure = reject));
  failure.catch(() => undefined);
  const elk = new ElkEngine({
    workerUrl: new URL('out/elk-worker.min.js', document.baseURI).href,
    // The worker script exports itself when it finds a `module`. With `nodeIntegrationInWorker` there is a `module`
    // but no `exports`, so it would throw before it listens for messages.
    workerFactory: (url) => {
      const bootstrap = `var exports = {}; importScripts(${JSON.stringify(url)});`;
      const worker = new Worker(URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' })));
      worker.addEventListener('error', (event) => {
        worker.terminate();
        engine = null;
        reportFailure(new Error(`The layout engine failed to start: ${event.message}`));
      });
      return worker;
    },
  });
  engine = { elk, failure };
  return engine;
}

const compareKeys = (first: { key: string }, second: { key: string }): number => first.key.localeCompare(second.key);

function buildGraph(input: LandscapeLayoutInput): ElkNode {
  const nodes = [...input.nodes].sort(compareKeys);
  const knownKeys = new Set(nodes.map((node) => node.key));
  const usedKinds = input.options.callHierarchy ? ['callActivity'] : ['callActivity', 'message', 'signal'];
  // Several relations between two processes are one line; a process does not call itself.
  const pairs = new Map<string, LandscapeLayoutEdge>();
  for (const edge of input.edges) {
    if (
      usedKinds.includes(edge.kind) &&
      edge.sourceKey !== edge.targetKey &&
      knownKeys.has(edge.sourceKey) &&
      knownKeys.has(edge.targetKey)
    ) {
      pairs.set(`${edge.sourceKey}\n${edge.targetKey}`, edge);
    }
  }
  const edges = [...pairs.entries()]
    .sort(([firstPair], [secondPair]) => firstPair.localeCompare(secondPair))
    .map(([, edge], index): ElkExtendedEdge => ({
      id: `edge:${index}`,
      sources: [`node:${edge.sourceKey}`],
      targets: [`node:${edge.targetKey}`],
    }));

  const groups = new Map<string, ElkNode>();
  const children: ElkNode[] = [];
  for (const node of nodes) {
    const processNode: ElkNode = { id: `node:${node.key}`, width: PROCESS_SHAPE_WIDTH, height: PROCESS_SHAPE_HEIGHT };
    if (node.groupKey == null) {
      children.push(processNode);
      continue;
    }
    let group = groups.get(node.groupKey);
    if (group == null) {
      group = {
        id: `group:${node.groupKey}`,
        labels: [{ text: node.groupLabel ?? node.groupKey }],
        layoutOptions: {
          'elk.padding': `[top=${GROUP_PADDING.top},left=${GROUP_PADDING.left},bottom=${GROUP_PADDING.bottom},right=${GROUP_PADDING.right}]`,
        },
        children: [],
      };
      groups.set(node.groupKey, group);
      children.push(group);
    }
    group.children?.push(processNode);
  }

  return {
    id: 'landscape',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.spacing.componentComponent': '60',
    },
    children,
    edges,
  };
}

async function runLayout(graph: ElkNode): Promise<ElkNode> {
  const { elk, failure } = getEngine();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      // The worker may still be computing; the next layout starts a fresh one.
      elk.terminateWorker();
      engine = null;
      reject(new Error(`The layout did not finish within ${LAYOUT_TIMEOUT_MILLISECONDS / 1000} seconds.`));
    }, LAYOUT_TIMEOUT_MILLISECONDS);
  });
  try {
    return await Promise.race([elk.layout(graph), timeout, failure]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Arranges processes with the layered algorithm of the Eclipse Layout Kernel: callers above callees, crossings kept
 * low, grouped processes inside their group's box. The same input in any order gives the same result.
 *
 * ponytail: one group level only (the wizard groups by folder or file); nested folders would become nested ELK
 * children of the same shape.
 */
export async function layoutLandscape(input: LandscapeLayoutInput): Promise<LandscapeLayout> {
  const graph = buildGraph(input);
  let laidOut: ElkNode;
  try {
    laidOut = await runLayout(graph);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`The layout of ${input.nodes.length} processes failed: ${reason}`, { cause: error });
  }

  const layout: LandscapeLayout = { nodes: new Map(), groups: [] };
  for (const child of laidOut.children ?? []) {
    if (child.id.startsWith('node:')) {
      layout.nodes.set(child.id.slice('node:'.length), { x: child.x ?? 0, y: child.y ?? 0 });
      continue;
    }
    const groupX = child.x ?? 0;
    const groupY = child.y ?? 0;
    layout.groups.push({
      key: child.id.slice('group:'.length),
      label: child.labels?.[0]?.text ?? '',
      x: groupX,
      y: groupY,
      width: child.width ?? 0,
      height: child.height ?? 0,
    });
    for (const member of child.children ?? []) {
      layout.nodes.set(member.id.slice('node:'.length), { x: groupX + (member.x ?? 0), y: groupY + (member.y ?? 0) });
    }
  }
  layout.groups.sort(compareKeys);
  return layout;
}
