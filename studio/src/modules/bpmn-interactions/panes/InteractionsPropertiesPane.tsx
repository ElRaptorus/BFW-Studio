import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneBody } from '#components/panes/PaneBody';
import { PaneHeader } from '#components/panes/PaneHeader';

import React from 'react';

import { PaneProperty } from '@elraptorus/bfw_studio_sdk';

import InteractionsDocumentModel from '../InteractionsDocumentModel';
import type {
  InteractionGraph,
  InteractionGraphLine,
  InteractionGraphPort,
  InteractionGraphProcess,
  InteractionGraphStation,
} from '../buildInteractionGraph';

function formatInterrupting(interrupting: boolean | null | undefined): string {
  if (interrupting == null) {
    return '—';
  }
  return interrupting ? 'Yes' : 'No';
}

function formatPortEventLabel(port: InteractionGraphPort): string {
  const kindLabel = port.kind === 'message' ? 'Message' : 'Signal';
  switch (port.position) {
    case 'start':
      return `${kindLabel} start event`;
    case 'intermediateCatch':
      return `${kindLabel} intermediate catch event`;
    case 'boundary':
      return `${kindLabel} boundary event`;
    case 'intermediateThrow':
      return `${kindLabel} intermediate throw event`;
    case 'end':
      return `${kindLabel} end event`;
    case 'sendTask':
      return 'Send task';
    case 'receiveTask':
      return 'Receive task';
    default:
      return port.position;
  }
}

function showsAttachedTo(port: InteractionGraphPort): boolean {
  return port.position === 'boundary';
}

function showsInterrupting(port: InteractionGraphPort): boolean {
  if (port.position === 'boundary') {
    return true;
  }
  if (port.position === 'start') {
    const innermostScope = port.location[port.location.length - 1];
    return innermostScope?.eventSubprocess === true;
  }
  return false;
}

function showsCorrelationRetrieval(port: InteractionGraphPort): boolean {
  return (
    port.kind === 'message' &&
    (port.position === 'intermediateThrow' || port.position === 'end' || port.position === 'sendTask')
  );
}

function getPaneTitle(_editorDocument: EditorDocument, model: EditorDocumentModel): string {
  if (!(model instanceof InteractionsDocumentModel)) {
    return 'Properties';
  }
  const element = model.resolveCanvasElement();
  if (element == null) {
    return 'Interactions';
  }
  if ('fileLabel' in element) {
    return 'Process';
  }
  if ('flowNodeId' in element) {
    return 'Port';
  }
  if ('sourceId' in element) {
    return 'Line';
  }
  return 'Station';
}

export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed: (editorDocument, model) =>
    editorDocument?.documentType === 'bpmn-interactions-map' && model instanceof InteractionsDocumentModel,
  Pane: PaneFull,
  PaneContent,
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader
        studio={props.studio}
        title={getPaneTitle(props.editorDocument, props.editorDocumentModel)}
        paneId={props.paneId}
        collapsed={props.collapsed}
      />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const model: InteractionsDocumentModel = props.editorDocumentModel;
  const revision =
    (props.editorDocument.metadata?.selectionRevision ?? 0) + (props.editorDocument.metadata?.generationRevision ?? 0);
  const element = model.resolveCanvasElement();
  if (element == null) {
    return <DiagramSummary key={`summary-${revision}`} studio={props.studio} model={model} />;
  }
  if ('fileLabel' in element) {
    return <ProcessView key={`${element.id}-${revision}`} studio={props.studio} model={model} process={element} />;
  }
  if ('flowNodeId' in element) {
    return <PortView key={`${element.id}-${revision}`} studio={props.studio} model={model} port={element} />;
  }
  if ('sourceId' in element) {
    return <LineView key={`${element.id}-${revision}`} model={model} line={element} />;
  }
  return <StationView key={`${element.id}-${revision}`} model={model} station={element} />;
}

function DiagramSummary(props: { studio: Bifrost; model: InteractionsDocumentModel }): React.JSX.Element {
  const summary = props.model.getDiagramSummary();
  const hasGeneratedDiagram = props.model.hasGeneratedDiagram();
  return (
    <PaneBody data-test--interactions-properties-summary>
      {!hasGeneratedDiagram && (
        <p className="interactions-empty" style={{ padding: '0.5rem 0', margin: 0 }}>
          Generate the diagram to see its summary.
        </p>
      )}
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        data-test--interactions-summary-add-all-partners
        disabled={summary.portsWithPartnersOutsideView === 0}
        onClick={() => void props.studio.commands.executeCommand('bpmn.interactions.addAllPartnersOutsideView')}
      >
        Ports with partners outside the view ({summary.portsWithPartnersOutsideView})
      </button>
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        data-test--interactions-summary-next-unconnected
        disabled={summary.portsWithoutPartnerInSolution === 0}
        onClick={() => void props.studio.commands.executeCommand('bpmn.interactions.revealNextUnconnectedPort')}
      >
        Unconnected ports ({summary.portsWithoutPartnerInSolution})
      </button>
    </PaneBody>
  );
}

function ProcessView(props: {
  studio: Bifrost;
  model: InteractionsDocumentModel;
  process: InteractionGraphProcess;
}): React.JSX.Element {
  const { studio, model, process } = props;
  const catalogProcess = model.findCatalogProcess(process.uri, process.processId);
  const portCount =
    model
      .getInteractionGraph()
      ?.ports.filter((port) => port.uri === process.uri && port.processId === process.processId).length ?? 0;
  return (
    <PaneBody>
      <PaneProperty type="text" label="Label" value={process.label} disabled />
      <PaneProperty type="text" label="Process ID" value={process.processId} disabled />
      <PaneProperty type="text" label="File" value={model.getRelativePath(process.uri)} disabled />
      <PaneProperty type="text" label="Version" value={catalogProcess?.version ?? '—'} disabled />
      <PaneProperty type="text" label="Correlation key" value={catalogProcess?.correlationKey ?? '—'} disabled />
      <PaneProperty type="text" label="Ports in view" value={String(portCount)} disabled />
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        data-test--interactions-properties-open
        onClick={() => void studio.commands.executeCommand('bpmn.interactions.openElement', [process.id])}
      >
        Open
      </button>
    </PaneBody>
  );
}

/** Labels of the processes a port talks to in the view, directly or through its station. */
function partnerProcessLabelsInView(graph: InteractionGraph | null, port: InteractionGraphPort): string[] {
  if (graph == null) {
    return [];
  }
  const neighbourIds = (elementId: string): string[] =>
    graph.lines.flatMap((line) => {
      if (line.sourceId === elementId) {
        return [line.targetId];
      }
      return line.targetId === elementId ? [line.sourceId] : [];
    });
  const partnerPortIds = neighbourIds(port.id).flatMap((neighbourId) =>
    neighbourId.startsWith('station:')
      ? neighbourIds(neighbourId).filter((stationNeighbourId) => stationNeighbourId !== port.id)
      : [neighbourId],
  );
  const partnerPorts = graph.ports.filter(
    (candidate) => partnerPortIds.includes(candidate.id) && candidate.direction !== port.direction,
  );
  return [...new Set(partnerPorts.map((partner) => partner.processLabel))];
}

function PortView(props: {
  studio: Bifrost;
  model: InteractionsDocumentModel;
  port: InteractionGraphPort;
}): React.JSX.Element {
  const { studio, model, port } = props;
  const graph = model.getInteractionGraph();
  const partnersInView = partnerProcessLabelsInView(graph, port);
  const locationPath = port.location.map((scope) => scope.name ?? scope.id).join(' › ');
  return (
    <PaneBody>
      <PaneProperty type="text" label="Event" value={formatPortEventLabel(port)} disabled />
      <PaneProperty type="text" label="Name" value={port.name ?? port.nameWarning ?? '—'} disabled />
      <PaneProperty type="text" label="Element name" value={port.flowNodeName ?? '—'} disabled />
      <PaneProperty type="text" label="Element ID" value={port.flowNodeId} disabled />
      {port.location.length > 0 && <PaneProperty type="text" label="Location" value={locationPath} disabled />}
      {showsAttachedTo(port) && (
        <PaneProperty
          type="text"
          label="Attached to"
          value={port.attachedToName ?? port.attachedToId ?? '—'}
          disabled
        />
      )}
      {showsInterrupting(port) && (
        <PaneProperty type="text" label="Interrupting" value={formatInterrupting(port.interrupting)} disabled />
      )}
      {showsCorrelationRetrieval(port) && (
        <PaneProperty
          type="text"
          label="Correlation retrieval"
          value={port.correlationRetrievalExpression ?? '—'}
          disabled
        />
      )}
      <PaneProperty type="text" label="Partners in view" value={partnersInView.join(', ') || '—'} disabled />
      <PaneProperty
        type="text"
        label="Partners outside the view"
        value={
          port.partnersOutsideView.length === 0
            ? '—'
            : port.partnersOutsideView
                .map((partner) => `${partner.processId} (${model.getRelativePath(partner.uri)})`)
                .join(', ')
        }
        disabled
      />
      {port.partnersOutsideView.length > 0 && (
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          data-test--interactions-properties-add-partners
          onClick={() => void studio.commands.executeCommand('bpmn.interactions.addPartnersOutsideView', [port.id])}
        >
          Add to view
        </button>
      )}
      {port.showNoPartnerInSolutionGlyph && (
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          data-test--interactions-properties-next-unconnected
          onClick={() => void studio.commands.executeCommand('bpmn.interactions.revealNextUnconnectedPort')}
        >
          Next unconnected port
        </button>
      )}
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        data-test--interactions-properties-open
        onClick={() => void studio.commands.executeCommand('bpmn.interactions.openElement', [port.id])}
      >
        Open
      </button>
    </PaneBody>
  );
}

function LineView(props: { model: InteractionsDocumentModel; line: InteractionGraphLine }): React.JSX.Element {
  const { line } = props;
  const graph = props.model.getInteractionGraph();
  const resolveLabel = (elementId: string): string => {
    const port = graph?.ports.find((candidate) => candidate.id === elementId);
    if (port != null) {
      return port.processLabel;
    }
    return graph?.stations.find((candidate) => candidate.id === elementId)?.name ?? elementId;
  };
  const sourceLabel = resolveLabel(line.sourceId);
  const targetLabel = resolveLabel(line.targetId);
  const senders = line.sourceId.startsWith('station:') ? sourceLabel : `${sourceLabel} (${line.sourceId})`;
  const receivers = line.targetId.startsWith('station:') ? targetLabel : `${targetLabel} (${line.targetId})`;
  return (
    <PaneBody>
      <PaneProperty type="text" label="Kind" value={line.kind} disabled />
      <PaneProperty type="text" label="Name" value={line.name} disabled />
      <PaneProperty type="text" label="Senders" value={senders} disabled />
      <PaneProperty type="text" label="Receivers" value={receivers} disabled />
    </PaneBody>
  );
}

function StationView(props: { model: InteractionsDocumentModel; station: InteractionGraphStation }): React.JSX.Element {
  const graph = props.model.getInteractionGraph();
  const senderPorts =
    graph?.lines
      .filter((line) => line.targetId === props.station.id)
      .map((line) => graph.ports.find((port) => port.id === line.sourceId)?.processLabel)
      .filter((label): label is string => label != null) ?? [];
  const receiverPorts =
    graph?.lines
      .filter((line) => line.sourceId === props.station.id)
      .map((line) => graph.ports.find((port) => port.id === line.targetId)?.processLabel)
      .filter((label): label is string => label != null) ?? [];
  return (
    <PaneBody>
      <PaneProperty type="text" label="Kind" value={props.station.kind} disabled />
      <PaneProperty type="text" label="Name" value={props.station.name} disabled />
      <PaneProperty type="text" label="Senders" value={senderPorts.join(', ') || '—'} disabled />
      <PaneProperty type="text" label="Receivers" value={receiverPorts.join(', ') || '—'} disabled />
    </PaneBody>
  );
}
