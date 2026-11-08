import { layoutElkNode } from '#modules/bpmn-core/elkLayoutEngine';
import type { ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api';

import type { InteractionGraph, InteractionLayoutMode } from './buildInteractionGraph';

export const INTERACTION_PROCESS_WIDTH = 200;
export const INTERACTION_PROCESS_HEIGHT = 100;
const STATION_WIDTH = 80;
const STATION_HEIGHT = 36;
export const PORT_SIZE = 24;
/** Vertical offset before the first port row, below the process header. */
const PORT_INSET = 40;
/** Distance from one port row to the next. */
const PORT_GAP = PORT_SIZE + 20;

export type InteractionLayoutPoint = {
  x: number;
  y: number;
};

export type InteractionLayoutBounds = InteractionLayoutPoint & { width: number; height: number };

/** Absolute positions keyed by the graph ids; edges are keyed by line id. */
export type InteractionGraphLayout = {
  processes: Map<string, InteractionLayoutBounds>;
  ports: Map<string, InteractionLayoutPoint>;
  stations: Map<string, InteractionLayoutBounds>;
  edges: Map<string, { waypoints: InteractionLayoutPoint[] }>;
};

function buildElkGraph(graph: InteractionGraph, layout: InteractionLayoutMode): ElkNode {
  const processChildren: ElkNode[] = graph.processes.map((process) => {
    const portsOnProcess = graph.ports.filter(
      (port) => port.uri === process.uri && port.processId === process.processId,
    );
    const catchCount = portsOnProcess.filter((port) => port.direction === 'catch').length;
    const portRows = Math.max(catchCount, portsOnProcess.length - catchCount, 1);
    // ELK orders ports clockwise: the east side runs top to bottom, the west side bottom to top.
    let catchIndex = catchCount;
    let throwIndex = 0;
    const ports: ElkPort[] = portsOnProcess.map((port) => {
      const isCatch = port.direction === 'catch';
      return {
        id: port.id,
        width: PORT_SIZE,
        height: PORT_SIZE,
        layoutOptions: {
          'port.side': isCatch ? 'WEST' : 'EAST',
          'port.index': String(isCatch ? --catchIndex : throwIndex++),
        },
      };
    });
    return {
      id: process.id,
      width: INTERACTION_PROCESS_WIDTH,
      height: Math.max(INTERACTION_PROCESS_HEIGHT, PORT_INSET * 2 + (portRows - 1) * PORT_GAP + PORT_SIZE),
      layoutOptions: { portConstraints: 'FIXED_ORDER' },
      ports,
    };
  });
  const stationChildren: ElkNode[] = graph.stations.map((station) => ({
    id: station.id,
    width: STATION_WIDTH,
    height: STATION_HEIGHT,
  }));
  const edges: ElkExtendedEdge[] = graph.lines.map((line) => ({
    id: line.id,
    sources: [line.sourceId],
    targets: [line.targetId],
  }));

  const layoutOptions: Record<string, string> = {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.spacing.nodeNode': '48',
    'elk.layered.spacing.nodeNodeBetweenLayers': '64',
  };
  if (layout === 'direct') {
    layoutOptions['elk.layered.mergeEdges'] = 'true';
  }
  return { id: 'interactions', layoutOptions, children: [...processChildren, ...stationChildren], edges };
}

function waypointsFromEdge(edge: ElkExtendedEdge): InteractionLayoutPoint[] {
  const section = edge.sections?.[0];
  if (section == null) {
    return [];
  }
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(({ x, y }) => ({ x, y }));
}

/**
 * Lays out an interaction graph with the layered algorithm of the Eclipse Layout Kernel: rightward, orthogonal
 * edges, catch ports on the west and throw ports on the east side of each process in graph order.
 */
export async function layoutInteractionGraph(
  graph: InteractionGraph,
  layout: InteractionLayoutMode,
): Promise<InteractionGraphLayout> {
  let laidOut: ElkNode;
  try {
    laidOut = await layoutElkNode(buildElkGraph(graph, layout));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`The interaction layout failed: ${reason}`, { cause: error });
  }

  const result: InteractionGraphLayout = {
    processes: new Map(),
    ports: new Map(),
    stations: new Map(),
    edges: new Map(),
  };
  const stationIds = new Set(graph.stations.map((station) => station.id));
  for (const child of laidOut.children ?? []) {
    const x = child.x ?? 0;
    const y = child.y ?? 0;
    const bounds = { x, y, width: child.width ?? 0, height: child.height ?? 0 };
    (stationIds.has(child.id) ? result.stations : result.processes).set(child.id, bounds);
    for (const port of child.ports ?? []) {
      result.ports.set(port.id, { x: x + (port.x ?? 0), y: y + (port.y ?? 0) });
    }
  }
  // Edges between top-level children are laid out in the root's coordinates.
  for (const edge of laidOut.edges ?? []) {
    result.edges.set(edge.id, { waypoints: waypointsFromEdge(edge) });
  }
  return result;
}
