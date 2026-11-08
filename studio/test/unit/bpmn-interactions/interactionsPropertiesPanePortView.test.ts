/**
 * @vitest-environment jsdom
 */
import { vi } from 'vitest';

vi.mock('#modules/bpmn-interactions/viewer/InteractionsViewer', () => ({
  default: class MockInteractionsViewer {
    container = { isConnected: false, remove: () => undefined };
    destroy = vi.fn();
  },
}));

vi.mock('@elraptorus/bfw_studio_sdk', () => ({
  PaneProperty: ({ label, value }: { label?: string; value: string }) => {
    const React = require('react');
    return React.createElement(
      'div',
      null,
      label != null ? React.createElement('label', { className: 'd-block' }, label) : null,
      React.createElement('span', null, value),
    );
  },
}));

import type { Bifrost } from '#bifrost/Bifrost';
import type { EditorDocument } from '#bifrost/contracts/EditorTypes';
import type { InteractionGraphPort } from '#modules/bpmn-interactions/buildInteractionGraph';
import { paneProvider } from '#modules/bpmn-interactions/panes/InteractionsPropertiesPane';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import React, { act } from 'react';

function basePort(overrides: Partial<InteractionGraphPort>): InteractionGraphPort {
  return {
    id: 'port-1',
    uri: 'file:///a/process.bpmn',
    processId: 'Process',
    processLabel: 'Process',
    flowNodeId: 'Flow_1',
    flowNodeName: 'My flow node',
    kind: 'message',
    direction: 'throw',
    position: 'end',
    name: 'Evt',
    nameWarning: null,
    interrupting: null,
    attachedToId: null,
    attachedToName: null,
    location: [],
    correlationRetrievalExpression: null,
    partnersOutsideView: [],
    partnersOutsideViewCount: 0,
    hasPartnerInSolution: true,
    showPartnersOutsideViewStub: false,
    showNoPartnerInSolutionGlyph: false,
    ...overrides,
  };
}

function renderPortPane(port: InteractionGraphPort): HTMLElement {
  const container = document.createElement('div');
  const root = createRoot(container);
  const studio = {
    commands: { executeCommand: vi.fn() },
  } as unknown as Bifrost;
  const editorDocument = {
    label: 'Interactions',
    icon: 'ph ph-share-network',
    hasUnsavedChanges: false,
    uri: 'interactions://solution',
    documentType: 'bpmn-interactions-map',
    rendererKey: 'interactions',
    modelKey: 'interactions',
    metadata: { selectionRevision: 1, generationRevision: 1 },
    data: { original: '', current: '' },
  } as EditorDocument;
  const model = {
    resolveCanvasElement: () => port,
    getInteractionGraph: () => ({ ports: [port], lines: [], processes: [], stations: [] }),
    getRelativePath: (uri: string) => uri,
    findCatalogProcess: () => null,
    getDiagramSummary: () => ({
      processCount: 1,
      portCount: 1,
      lineCount: 0,
      stationCount: 0,
      portsWithPartnersOutsideView: 0,
      portsWithoutPartnerInSolution: 0,
    }),
  };
  const PaneContent = paneProvider.PaneContent as (props: {
    studio: Bifrost;
    editorDocument: EditorDocument;
    editorDocumentModel: typeof model;
    paneId: string;
    collapsed: boolean;
  }) => React.JSX.Element | null;

  act(() => {
    root.render(
      React.createElement(PaneContent, {
        studio,
        editorDocument,
        editorDocumentModel: model,
        paneId: 'property',
        collapsed: false,
      }),
    );
  });
  return container;
}

function propertyLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('label.d-block')].map((node) => node.textContent?.trim() ?? '');
}

describe('InteractionsPropertiesPane port view', () => {
  it('shows event type only and hides boundary-only fields for a signal end event', () => {
    const container = renderPortPane(
      basePort({ kind: 'signal', position: 'end', direction: 'throw', flowNodeId: 'End_1' }),
    );
    expect(container.textContent).toContain('Signal end event');
    const labels = propertyLabels(container);
    expect(labels).toContain('Event');
    expect(labels).not.toContain('Attached to');
    expect(labels).not.toContain('Interrupting');
    expect(labels).not.toContain('Correlation retrieval');
    expect(labels).not.toContain('Location');
  });

  it('shows attached to and interrupting for a message boundary event', () => {
    const container = renderPortPane(
      basePort({
        position: 'boundary',
        direction: 'catch',
        attachedToId: 'Task_1',
        attachedToName: 'Review',
        interrupting: true,
      }),
    );
    expect(container.textContent).toContain('Message boundary event');
    const labels = propertyLabels(container);
    expect(labels).toContain('Attached to');
    expect(labels).toContain('Interrupting');
    expect(labels).not.toContain('Correlation retrieval');
  });

  it('shows correlation retrieval for a message send task', () => {
    const container = renderPortPane(
      basePort({
        position: 'sendTask',
        direction: 'throw',
        correlationRetrievalExpression: 'token.orderId',
      }),
    );
    expect(container.textContent).toContain('Send task');
    expect(propertyLabels(container)).toContain('Correlation retrieval');
  });

  it('shows interrupting for a start event only inside an event subprocess', () => {
    const topLevelStart = renderPortPane(basePort({ position: 'start', direction: 'catch', interrupting: true }));
    expect(propertyLabels(topLevelStart)).not.toContain('Interrupting');

    const eventSubprocessStart = renderPortPane(
      basePort({
        position: 'start',
        direction: 'catch',
        interrupting: false,
        location: [
          { id: 'Sub_1', name: 'Validate', eventSubprocess: false },
          { id: 'EventSub_1', name: 'On cancel', eventSubprocess: true },
        ],
      }),
    );
    expect(propertyLabels(eventSubprocessStart)).toContain('Interrupting');
  });

  it('shows location only when the port is inside a subprocess', () => {
    const withoutLocation = renderPortPane(basePort({ position: 'intermediateCatch', direction: 'catch' }));
    expect(propertyLabels(withoutLocation)).not.toContain('Location');

    const withLocation = renderPortPane(
      basePort({
        position: 'intermediateCatch',
        direction: 'catch',
        location: [{ id: 'Sub_1', name: 'Validate', eventSubprocess: false }],
      }),
    );
    expect(propertyLabels(withLocation)).toContain('Location');
    expect(withLocation.textContent).toContain('Validate');
  });
});
