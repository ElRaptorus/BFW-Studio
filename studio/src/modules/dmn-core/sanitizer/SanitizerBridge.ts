import type { Bifrost } from '#bifrost/Bifrost';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import ReactDOM from 'react-dom/client';

import React from 'react';

import { type ModdleParseWarning, analyzeDmnSanitizableIssues } from './DmnSanitizerAnalyzer';
import { SanitizerBadge } from './SanitizerBadge';
import type { DmnSanitizableIssue } from './sanitizerTypes';

interface ModdleNode {
  $type: string;
  $parent?: ModdleNode;
  [key: string]: any;
}

export interface DmnSanitizerBridgeApi {
  getFindings(): DmnSanitizableIssue[];
  getFindingsCount(): number;
  dismissDanglingRefWarnings(elementIds: string[]): void;
}

interface DmnSanitizerBridgeInstance extends DmnSanitizerBridgeApi {
  _findings: DmnSanitizableIssue[];
  _parseWarnings: ModdleParseWarning[];
  _debounceTimer: ReturnType<typeof setTimeout> | null;
  _badgeContainer: HTMLDivElement | null;
  _badgeRoot: ReactDOM.Root | null;
  _boundDocumentUri: string | null;
  _scheduleAnalysis(): void;
  _runAnalysis(): void;
  _renderBadge(): void;
  _destroyBadge(): void;
}

const DIAGNOSTICS_OWNER = 'dmn-sanitizer';
const DEFAULT_DEBOUNCE_MS = 300;

function getDefinitionsFromRoot(rootShape: { businessObject?: ModdleNode } | null | undefined): any {
  let bo: ModdleNode | undefined = rootShape?.businessObject;
  while (bo != null && bo.$type !== 'dmn:Definitions') {
    bo = bo.$parent;
  }
  return bo ?? null;
}

export function DmnSanitizerBridge(
  this: DmnSanitizerBridgeInstance,
  eventBus: EventBus,
  canvas: Canvas,
  elementRegistry: ElementRegistry,
  dmnSanitizerBridgeStudio: Bifrost,
) {
  const studio = dmnSanitizerBridgeStudio;
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
  this._boundDocumentUri = null;

  this.getFindings = () => this._findings;
  this.getFindingsCount = () => this._findings.length;

  this.dismissDanglingRefWarnings = (elementIds: string[]) => {
    const idSet = new Set(elementIds);
    const drgTypes = new Set([
      'dmn:Decision',
      'dmn:InputData',
      'dmn:BusinessKnowledgeModel',
      'dmn:KnowledgeSource',
      'dmn:DecisionService',
    ]);
    this._parseWarnings = this._parseWarnings.filter((warning) => {
      if (!warning.message?.startsWith('unresolved reference')) {
        return true;
      }
      let current = warning.element?.$parent;
      while (current != null) {
        if (current.id && current.$type && drgTypes.has(current.$type)) {
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

      const definitions = getDefinitionsFromRoot(rootShape);
      if (!definitions) {
        return;
      }

      this._findings = analyzeDmnSanitizableIssues(definitions, elementRegistry, this._parseWarnings);
      eventBus.fire('sanitizer.findingsChanged', { findings: this._findings });

      this._renderBadge();

      if (!this._boundDocumentUri) {
        this._boundDocumentUri = studio.editors.getFocusedEditorDocument()?.uri ?? null;
      }
      if (this._boundDocumentUri) {
        const items = this._findings.map((issue) => ({
          severity: issue.severity as 'error' | 'warning' | 'info',
          message: issue.label,
          source: DIAGNOSTICS_OWNER,
        }));
        diagnostics.setDiagnostics(this._boundDocumentUri, DIAGNOSTICS_OWNER, items);
      }
    } catch (err) {
      console.error('[dmn-sanitizer] Analysis failed:', err);
    }
  };

  this._renderBadge = () => {
    if (!this._badgeRoot) {
      return;
    }

    this._badgeRoot.render(
      React.createElement(SanitizerBadge, {
        findings: this._findings,
        onShowInInspector: () => studio.commands.executeCommand('dmn.sanitizer.showInInspector'),
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
    const drdContainer: HTMLElement = canvas.getContainer();
    const editorContent = drdContainer.closest('.editor__content') || drdContainer.parentElement;
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
  eventBus.on('sanitizer.requestReanalysis', scheduleAfterChange);
  eventBus.on('import.done', (event: { warnings?: ModdleParseWarning[] }) => {
    if (Array.isArray(event.warnings)) {
      this._parseWarnings = event.warnings;
    }
    if (!this._boundDocumentUri) {
      this._boundDocumentUri = studio.editors.getFocusedEditorDocument()?.uri ?? null;
    }
    this._scheduleAnalysis();
  });

  eventBus.on('diagram.destroy', () => {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this._destroyBadge();

    if (this._boundDocumentUri) {
      diagnostics.setDiagnostics(this._boundDocumentUri, DIAGNOSTICS_OWNER, []);
    }
    this._boundDocumentUri = null;
  });
}

(DmnSanitizerBridge as any).$inject = ['eventBus', 'canvas', 'elementRegistry', 'dmnSanitizerBridgeStudio'];

export function createDmnSanitizerModule(studio: Bifrost) {
  return {
    __init__: ['dmnSanitizerBridge'],
    dmnSanitizerBridge: ['type', DmnSanitizerBridge],
    dmnSanitizerBridgeStudio: ['value', studio],
  };
}
