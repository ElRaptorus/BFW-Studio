import type {
  SolutionBpmnModelEntry,
  SolutionCommunicationEventEntry,
} from '#modules/bpmn-core/scanSolutionBpmnModels';

export type InteractionLayoutMode = 'direct' | 'stations';

export type InteractionSelectedProcessReference = {
  uri: string;
  processId: string;
};

export type InteractionGraphBuildOptions = {
  layout: InteractionLayoutMode;
  hideProcessesWithoutInteraction: boolean;
};

export type InteractionGraphProcess = {
  id: string;
  uri: string;
  processId: string;
  label: string;
  fileLabel: string;
};

export type InteractionGraphPort = {
  id: string;
  uri: string;
  processId: string;
  processLabel: string;
  flowNodeId: string;
  flowNodeName: string | null;
  kind: 'message' | 'signal';
  direction: 'throw' | 'catch';
  position: SolutionCommunicationEventEntry['position'];
  name: string | null;
  nameWarning: string | null;
  interrupting: boolean | null;
  attachedToId: string | null;
  attachedToName: string | null;
  location: SolutionCommunicationEventEntry['location'];
  correlationRetrievalExpression: string | null;
  partnersOutsideView: InteractionSelectedProcessReference[];
  partnersOutsideViewCount: number;
  hasPartnerInSolution: boolean;
  showPartnersOutsideViewStub: boolean;
  showNoPartnerInSolutionGlyph: boolean;
};

export type InteractionGraphStation = {
  id: string;
  kind: 'message' | 'signal';
  name: string;
};

export type InteractionGraphLine = {
  id: string;
  kind: 'message' | 'signal';
  name: string;
  /** A throw port; in station mode a throw port or the station. */
  sourceId: string;
  /** A catch port; in station mode the station or a catch port. */
  targetId: string;
};

export type InteractionGraph = {
  layout: InteractionLayoutMode;
  processes: InteractionGraphProcess[];
  ports: InteractionGraphPort[];
  stations: InteractionGraphStation[];
  lines: InteractionGraphLine[];
};

type CatalogPort = {
  processReference: InteractionSelectedProcessReference;
  processLabel: string;
  event: SolutionCommunicationEventEntry;
};

function processReferenceKey(reference: InteractionSelectedProcessReference): string {
  return `${reference.uri}#${reference.processId}`;
}

function processLabel(process: { id: string; name: string | null }): string {
  const trimmedName = process.name?.trim();
  return trimmedName != null && trimmedName.length > 0 ? trimmedName : process.id;
}

function fileLabelFromUri(uri: string): string {
  return decodeURIComponent(uri.slice(uri.lastIndexOf('/') + 1));
}

/** Same kind and name, opposite direction, different process. Unnamed events never match. */
function isPartner(first: CatalogPort, second: CatalogPort): boolean {
  return (
    first.event.name != null &&
    first.event.name === second.event.name &&
    first.event.kind === second.event.kind &&
    first.event.direction !== second.event.direction &&
    processReferenceKey(first.processReference) !== processReferenceKey(second.processReference)
  );
}

function comparePorts(first: InteractionGraphPort, second: InteractionGraphPort): number {
  return (
    first.processLabel.localeCompare(second.processLabel) ||
    first.kind.localeCompare(second.kind) ||
    first.direction.localeCompare(second.direction) ||
    (first.name ?? '').localeCompare(second.name ?? '') ||
    first.flowNodeId.localeCompare(second.flowNodeId) ||
    first.id.localeCompare(second.id)
  );
}

function compareProcesses(first: InteractionGraphProcess, second: InteractionGraphProcess): number {
  return first.label.localeCompare(second.label) || first.id.localeCompare(second.id);
}

function compareLines(first: InteractionGraphLine, second: InteractionGraphLine): number {
  return (
    first.kind.localeCompare(second.kind) ||
    first.name.localeCompare(second.name) ||
    first.sourceId.localeCompare(second.sourceId) ||
    first.targetId.localeCompare(second.targetId)
  );
}

function toGraphPort(
  catalogPort: CatalogPort,
  catalogPorts: CatalogPort[],
  selectedKeys: Set<string>,
): InteractionGraphPort {
  const { event, processReference } = catalogPort;
  const partners = new Map<string, InteractionSelectedProcessReference>();
  for (const candidate of catalogPorts) {
    if (isPartner(catalogPort, candidate)) {
      partners.set(processReferenceKey(candidate.processReference), { ...candidate.processReference });
    }
  }
  const partnersOutsideView = [...partners.entries()]
    .filter(([key]) => !selectedKeys.has(key))
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([, reference]) => reference);
  const hasPartnerInSolution = partners.size > 0;
  let nameWarning: string | null = null;
  if (event.name == null) {
    nameWarning = event.kind === 'message' ? 'No message name' : 'No signal name';
  }
  return {
    id: `${processReference.uri}#${processReference.processId}#${event.flowNodeId}`,
    uri: processReference.uri,
    processId: processReference.processId,
    processLabel: catalogPort.processLabel,
    flowNodeId: event.flowNodeId,
    flowNodeName: event.flowNodeName,
    kind: event.kind,
    direction: event.direction,
    position: event.position,
    name: event.name,
    nameWarning,
    interrupting: event.interrupting,
    attachedToId: event.attachedToId,
    attachedToName: event.attachedToName,
    location: event.location,
    correlationRetrievalExpression: event.correlationRetrievalExpression,
    partnersOutsideView,
    partnersOutsideViewCount: partnersOutsideView.length,
    hasPartnerInSolution,
    showPartnersOutsideViewStub: partnersOutsideView.length > 0,
    showNoPartnerInSolutionGlyph: event.name != null && !hasPartnerInSolution,
  };
}

/**
 * Builds the interaction graph from the solution catalog and the selected processes: one port per communication
 * event, lines between partners in view (directly, or through one station per kind and name), stubs for partners
 * outside the view. The same input in any order gives the same result.
 *
 * ponytail: direct mode is senders × receivers lines per name; station mode is the mitigation.
 */
export function buildInteractionGraph(
  catalog: SolutionBpmnModelEntry[],
  selectedReferences: InteractionSelectedProcessReference[],
  options: InteractionGraphBuildOptions,
): InteractionGraph {
  const selectedKeys = new Set(selectedReferences.map(processReferenceKey));
  const catalogPorts: CatalogPort[] = [];
  const processes: InteractionGraphProcess[] = [];
  for (const entry of catalog) {
    if (entry.kind !== 'bpmn') {
      continue;
    }
    for (const process of entry.processes) {
      const processReference = { uri: entry.uri, processId: process.id };
      const label = processLabel(process);
      for (const event of process.communicationEvents) {
        catalogPorts.push({ processReference, processLabel: label, event });
      }
      if (selectedKeys.has(processReferenceKey(processReference))) {
        processes.push({
          id: `process:${processReferenceKey(processReference)}`,
          ...processReference,
          label,
          fileLabel: fileLabelFromUri(entry.uri),
        });
      }
    }
  }

  const selectedCatalogPorts = catalogPorts.filter((catalogPort) =>
    selectedKeys.has(processReferenceKey(catalogPort.processReference)),
  );
  const pairs: { throwPort: CatalogPort; catchPort: CatalogPort }[] = [];
  for (const throwPort of selectedCatalogPorts) {
    if (throwPort.event.direction !== 'throw') {
      continue;
    }
    for (const catchPort of selectedCatalogPorts) {
      if (isPartner(throwPort, catchPort)) {
        pairs.push({ throwPort, catchPort });
      }
    }
  }

  let visibleProcesses = processes;
  let visibleCatalogPorts = selectedCatalogPorts;
  if (options.hideProcessesWithoutInteraction) {
    const connectedKeys = new Set(
      pairs.flatMap(({ throwPort, catchPort }) => [
        processReferenceKey(throwPort.processReference),
        processReferenceKey(catchPort.processReference),
      ]),
    );
    visibleProcesses = processes.filter((process) => connectedKeys.has(processReferenceKey(process)));
    visibleCatalogPorts = selectedCatalogPorts.filter((catalogPort) =>
      connectedKeys.has(processReferenceKey(catalogPort.processReference)),
    );
  }

  const portIds = new Map<CatalogPort, string>();
  const ports = visibleCatalogPorts.map((catalogPort) => {
    const port = toGraphPort(catalogPort, catalogPorts, selectedKeys);
    portIds.set(catalogPort, port.id);
    return port;
  });
  const stations = new Map<string, InteractionGraphStation>();
  const lines = new Map<string, InteractionGraphLine>();
  const addLine = (kind: 'message' | 'signal', name: string, sourceId: string, targetId: string): void => {
    const id = `line:${sourceId}->${targetId}`;
    lines.set(id, { id, kind, name, sourceId, targetId });
  };
  for (const { throwPort, catchPort } of pairs) {
    const { kind } = throwPort.event;
    const name = throwPort.event.name ?? '';
    const throwPortId = portIds.get(throwPort) ?? '';
    const catchPortId = portIds.get(catchPort) ?? '';
    if (options.layout === 'direct') {
      addLine(kind, name, throwPortId, catchPortId);
      continue;
    }
    const stationId = `station:${kind}:${name}`;
    stations.set(stationId, { id: stationId, kind, name });
    addLine(kind, name, throwPortId, stationId);
    addLine(kind, name, stationId, catchPortId);
  }

  return {
    layout: options.layout,
    processes: visibleProcesses.sort(compareProcesses),
    ports: ports.sort(comparePorts),
    stations: [...stations.values()].sort(
      (first, second) => first.kind.localeCompare(second.kind) || first.name.localeCompare(second.name),
    ),
    lines: [...lines.values()].sort(compareLines),
  };
}
