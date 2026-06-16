import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import ReactDOM from 'react-dom/client';

import React from 'react';

import type { Studio } from '@evil/bifrost_fw_sdk';

import { type ModdleParseWarning, analyzeSanitizableIssues } from './BpmnSanitizerAnalyzer';
import { SanitizerBadge } from './SanitizerBadge';
import type { SanitizableIssue } from './sanitizerTypes';

interface ModdleNode {
  $type: string;
  $parent?: ModdleNode;
  [key: string]: any;
}

export interface SanitizerBridgeApi {
  getFindings(): SanitizableIssue[];
  getFindingsCount(): number;
  dismissDanglingRefWarnings(elementIds: string[]): void;
}

interface SanitizerBridgeInstance extends SanitizerBridgeApi {
  _findings: SanitizableIssue[];
  _parseWarnings: ModdleParseWarning[];
  _debounceTimer: ReturnType<typeof setTimeout> | null;
  _badgeContainer: HTMLDivElement | null;
  _badgeRoot: ReactDOM.Root | null;
  _scheduleAnalysis(): void;
  _runAnalysis(): void;
  _renderBadge(): void;
  _destroyBadge(): void;
}

const DIAGNOSTICS_OWNER = 'bpmn-sanitizer';
const DEFAULT_DEBOUNCE_MS = 300;

function getDefinitionsBusinessObject(rootShape: { businessObject?: ModdleNode } | null | undefined): any {
  let bo: ModdleNode | undefined = rootShape?.businessObject;
  while (bo != null && bo.$type !== 'bpmn:Definitions') {
    bo = bo.$parent;
  }
  return bo ?? null;
}

export function SanitizerBridge(
  this: SanitizerBridgeInstance,
  eventBus: EventBus,
  canvas: Canvas,
  elementRegistry: ElementRegistry,
  sanitizerBridgeStudio: Studio,
) {
  const studio = sanitizerBridgeStudio;
  const diagnostics = (studio as any).diagnostics as {
    setDiagnostics(
      uri: string,
      owner: string,
      items: { severity: 'error' | 'warning' | 'info'; message: string; source: string }[],
    ): void;
  };
  this._findings = [];
  this._parseWarnings = [];
  this._debounceTimer = null;
  this._badgeContainer = null;
  this._badgeRoot = null;

  this.getFindings = () => this._findings;
  this.getFindingsCount = () => this._findings.length;

  this.dismissDanglingRefWarnings = (elementIds: string[]) => {
    const idSet = new Set(elementIds);
    this._parseWarnings = this._parseWarnings.filter((warning) => {
      if (!warning.message?.startsWith('unresolved reference')) {
        return true;
      }
      const ownerEl = warning.element?.$parent;
      let current = ownerEl;
      while (current != null) {
        if (current.id && current.$type && !current.$type.endsWith('EventDefinition')) {
          return !idSet.has(current.id);
        }
        current = current.$parent;
      }
      return true;
    });
    this._runAnalysis();
  };

  this._scheduleAnalysis = () => {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._runAnalysis();
    }, DEFAULT_DEBOUNCE_MS);
  };

  this._runAnalysis = () => {
    try {
      const rootShape = canvas.getRootElement();
      if (!rootShape) {
        return;
      }

      const definitions = getDefinitionsBusinessObject(rootShape);
      if (!definitions) {
        return;
      }

      this._findings = analyzeSanitizableIssues(definitions, elementRegistry, this._parseWarnings);
      eventBus.fire('sanitizer.findingsChanged', { findings: this._findings });

      this._renderBadge();

      const doc = studio.editors.getFocusedEditorDocument();
      if (doc?.uri) {
        const items = this._findings.map((issue) => ({
          severity: issue.severity as 'error' | 'warning' | 'info',
          message: issue.label,
          source: DIAGNOSTICS_OWNER,
        }));
        diagnostics.setDiagnostics(doc.uri, DIAGNOSTICS_OWNER, items);
      }
    } catch (err) {
      console.error('[bpmn-sanitizer] Analysis failed:', err);
    }
  };

  this._renderBadge = () => {
    if (!this._badgeRoot) {
      return;
    }

    this._badgeRoot.render(
      React.createElement(SanitizerBadge, {
        findings: this._findings,
        onShowInInspector: () => studio.commands.executeCommand('bpmn.sanitizer.showInInspector'),
      }),
    );
  };

  this._destroyBadge = () => {
    this._badgeRoot?.unmount();
    this._badgeRoot = null;
    this._badgeContainer?.remove();
    this._badgeContainer = null;
  };

  const mountBadge = () => {
    const bpmnContainer: HTMLElement = canvas.getContainer();
    const editorContent = bpmnContainer.closest('.editor__content') || bpmnContainer.parentElement;
    if (!editorContent) {
      return;
    }

    this._badgeRoot?.unmount();
    this._badgeContainer?.remove();

    this._badgeContainer = document.createElement('div');
    this._badgeContainer.className = 'sanitizer-badge-container';
    editorContent.appendChild(this._badgeContainer);
    this._badgeRoot = ReactDOM.createRoot(this._badgeContainer);

    this._renderBadge();
  };

  eventBus.on('canvas.init', () => mountBadge());

  eventBus.on('attach', () => {
    if (this._badgeContainer && !document.contains(this._badgeContainer)) {
      mountBadge();
    }
  });

  const scheduleAfterChange = () => this._scheduleAnalysis();

  eventBus.on('commandStack.changed', scheduleAfterChange);
  eventBus.on('elements.changed', scheduleAfterChange);
  eventBus.on('element.changed', scheduleAfterChange);
  eventBus.on('shape.added', scheduleAfterChange);
  eventBus.on('shape.removed', scheduleAfterChange);
  eventBus.on('connection.added', scheduleAfterChange);
  eventBus.on('connection.removed', scheduleAfterChange);
  eventBus.on('import.done', (event: { warnings?: ModdleParseWarning[] }) => {
    if (Array.isArray(event.warnings)) {
      this._parseWarnings = event.warnings;
    }
    this._scheduleAnalysis();
  });

  eventBus.on('diagram.destroy', () => {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this._destroyBadge();

    const doc = studio.editors.getFocusedEditorDocument();
    if (doc?.uri) {
      diagnostics.setDiagnostics(doc.uri, DIAGNOSTICS_OWNER, []);
    }
  });
}

(SanitizerBridge as any).$inject = ['eventBus', 'canvas', 'elementRegistry', 'sanitizerBridgeStudio'];

export function createSanitizerModule(studio: Studio) {
  return {
    __init__: ['sanitizerBridge'],
    sanitizerBridge: ['type', SanitizerBridge],
    sanitizerBridgeStudio: ['value', studio],
  };
}
