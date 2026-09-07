import {
  BFR_LINTER_RULESET_SCORE_COMMAND,
  type EvilLinterRulesetScorePayload,
} from '#modules/bpmn-core/bpmn-js/CommandHandler/UpdateEvilLinterRulesetScoreHandler';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type Overlays from 'diagram-js/lib/features/overlays/Overlays';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import ReactDOM from 'react-dom/client';

import React from 'react';

import { LintEngine } from './LintEngine';
import { LintOverlayManager } from './LintOverlayManager';
import { detectBpmnOrigin } from './detectBpmnOrigin';
import { ErrorSummaryBadge } from './overlays/ErrorSummaryBadge';
import { resolveScorePolicy } from './resolveScorePolicy';
import { computeLintScore } from './scoring/computeLintScore';
import type {
  BpmnDiagramOrigin,
  CustomRulesetEntry,
  FindingCounts,
  LintFinding,
  LintScoreSnapshot,
  ModdleDefinitions,
  ModdleNode,
  RuleSeverityConfig,
  ScorePolicy,
} from './types';

const HIGHLIGHT_MARKER = 'lint-highlight';

interface LintBridgeSettings {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  onSettingsUpdate(handler: (key: string, value: unknown) => void): { dispose(): void };
}

interface LintBridgeDiagnostics {
  setDiagnostics(
    uri: string,
    owner: string,
    diagnostics: { severity: 'error' | 'warning' | 'info'; message: string; source: string }[],
  ): void;
  clearDiagnostics(owner: string): void;
}

interface LintBridgeEditors {
  getFocusedEditorDocument(): { uri: string } | null;
}

interface LintBridgePaneLayout {
  requestUpdate(): void;
  updateCounts(counts: FindingCounts): void;
  showProblemsPane(): void;
}

interface LintBridgeInstance {
  eventBus: EventBus;
  canvas: Canvas;
  elementRegistry: ElementRegistry;
  overlays: Overlays;
  selection: Selection;
  commandStack: CommandStack;
  settings: LintBridgeSettings;
  diagnosticsMediator: LintBridgeDiagnostics;
  editorsMediator: LintBridgeEditors;
  paneLayout: LintBridgePaneLayout;
  engine: LintEngine;
  overlayManager: LintOverlayManager;
  _active: boolean;
  _debounceTimer: ReturnType<typeof setTimeout> | null;
  _badgeContainer: HTMLDivElement | null;
  _badgeRoot: ReactDOM.Root | null;
  _lastCounts: FindingCounts;
  _lastScoreSnapshot: LintScoreSnapshot | null;
  _resolvedScorePolicy: ScorePolicy;
  _lintScheduleSuppressionCount: number;
  _selectedElementIds: string[];
  _highlightedElementId: string | null;
  _diagramOrigin: BpmnDiagramOrigin | null;
  _foreignLintingAllowed: boolean;
  _boundDocumentUri: string | null;

  isActive(): boolean;
  toggle(): void;
  clearFindings(): void;
  getFindings(): LintFinding[];
  getCounts(): FindingCounts;
  getLintScoreSnapshot(): LintScoreSnapshot | null;
  getActiveProfile(): string;
  getAvailableProfiles(): { id: string; label: string; isCustom: boolean }[];
  selectElement(elementId: string, addToSelection?: boolean): void;
  highlightElement(elementId: string): void;
  unhighlightElement(elementId: string): void;
  getSelectedElementIds(): string[];
  getDiagramOrigin(): BpmnDiagramOrigin | null;
  isForeignDiagramLintingBlocked(): boolean;
  allowForeignLinting(): void;
  _scheduleLint(): void;
  _runLint(): Promise<void>;
  _renderBadge(): void;
  _destroyBadge(): void;
  _pushDiagnostics(findings: LintFinding[]): void;
  _getDocumentUri(): string | null;
  _bindDocumentUri(): string | null;
}

const DIAGNOSTICS_OWNER = 'bpmn-linter';
const DEFAULT_DEBOUNCE_MS = 300;

const SCORE_COMPARISON_KEYS: readonly (keyof EvilLinterRulesetScorePayload)[] = [
  'rulesetId',
  'scorePercent',
  'complianceStatus',
  'schemaVersion',
  'maxPoints',
  'penaltyPoints',
  'rawErrorFindings',
  'rawWarningFindings',
];

function getDefinitionsBusinessObject(
  rootShape: { businessObject?: ModdleNode } | null | undefined,
): ModdleDefinitions | null {
  let bo: ModdleNode | undefined = rootShape?.businessObject;
  while (bo != null && bo.$type !== 'bpmn:Definitions') {
    bo = bo.$parent;
  }
  return (bo as unknown as ModdleDefinitions) ?? null;
}

function readExistingScore(definitions: ModdleDefinitions, rulesetId: string): Record<string, string> | null {
  const extensionElements = definitions.extensionElements as { values?: unknown[] } | undefined;
  const values = extensionElements?.values;
  if (!Array.isArray(values)) {
    return null;
  }
  const evilProps = values.find((val: unknown) => (val as { $type?: string }).$type === 'evil:Properties') as
    { linterRulesetScores?: unknown[] } | undefined;
  const scores = evilProps?.linterRulesetScores;
  if (!Array.isArray(scores)) {
    return null;
  }
  type ModdleEntry = Record<string, unknown> & { get?(prop: string): unknown };
  const entry = scores.find((score: unknown) => {
    const obj = score as ModdleEntry;
    return (obj.get?.('rulesetId') ?? obj.rulesetId) === rulesetId;
  }) as ModdleEntry | undefined;
  if (!entry) {
    return null;
  }
  const result: Record<string, string> = {};
  for (const key of SCORE_COMPARISON_KEYS) {
    result[key] = String(entry.get?.(key) ?? entry[key] ?? '');
  }
  return result;
}

function scoreMatchesExisting(
  newScore: EvilLinterRulesetScorePayload,
  existing: Record<string, string> | null,
): boolean {
  if (!existing) {
    return false;
  }
  return SCORE_COMPARISON_KEYS.every((key) => String(newScore[key]) === existing[key]);
}

export function LintBridge(
  this: LintBridgeInstance,
  eventBus: EventBus,
  canvas: Canvas,
  elementRegistry: ElementRegistry,
  overlays: Overlays,
  selection: Selection,
  commandStack: CommandStack,
  lintBridgeSettings: LintBridgeSettings,
  lintBridgeDiagnostics: LintBridgeDiagnostics,
  lintBridgeEditors: LintBridgeEditors,
  lintBridgePaneLayout: LintBridgePaneLayout,
) {
  this.eventBus = eventBus;
  this.canvas = canvas;
  this.elementRegistry = elementRegistry;
  this.overlays = overlays;
  this.selection = selection;
  this.commandStack = commandStack;
  this.settings = lintBridgeSettings;
  this.diagnosticsMediator = lintBridgeDiagnostics;
  this.editorsMediator = lintBridgeEditors;
  this.paneLayout = lintBridgePaneLayout;
  this.engine = new LintEngine();
  this.overlayManager = new LintOverlayManager(canvas, elementRegistry);
  this._active = (this.settings.get('bpmnLinter.enabled') as boolean | undefined) ?? true;
  this._debounceTimer = null;
  this._badgeContainer = null;
  this._badgeRoot = null;
  this._lastCounts = { errors: 0, warnings: 0, infos: 0 };
  this._lastScoreSnapshot = null;
  this._lintScheduleSuppressionCount = 0;
  this._selectedElementIds = [];
  this._highlightedElementId = null;
  this._diagramOrigin = null;
  this._foreignLintingAllowed = false;
  this._boundDocumentUri = null;

  const applyProfile = () => {
    const profileName = (this.settings.get('bpmnLinter.profile') as string | undefined) ?? 'bpmn-development';
    const customRulesets =
      (this.settings.get('bpmnLinter.customRulesets') as Record<string, CustomRulesetEntry> | undefined) ?? {};
    this._resolvedScorePolicy = resolveScorePolicy(profileName, customRulesets);
    const customRuleset = customRulesets[profileName];

    if (customRuleset && typeof customRuleset === 'object') {
      const base: string = customRuleset.base ?? 'bpmn-development';
      const overrides: Record<string, RuleSeverityConfig> = {};
      const rules = customRuleset.rules;
      if (rules && typeof rules === 'object') {
        for (const [ruleId, severity] of Object.entries(rules)) {
          if (typeof severity === 'string') {
            overrides[ruleId] = severity as RuleSeverityConfig;
          }
        }
      }
      this.engine.setProfile(base);
      this.engine.setRuleOverrides(overrides);
    } else {
      this.engine.setProfile(profileName);
      this.engine.setRuleOverrides({});
    }
  };

  applyProfile();

  this.isActive = () => this._active;

  this.getActiveProfile = () => (this.settings.get('bpmnLinter.profile') as string | undefined) ?? 'bpmn-development';

  this.getAvailableProfiles = () => {
    const builtIn = [
      { id: 'bpmn-development', label: 'Development', isCustom: false },
      { id: 'bpmn-production-ready', label: 'Production Ready', isCustom: false },
    ];
    const customRulesets =
      (this.settings.get('bpmnLinter.customRulesets') as Record<string, CustomRulesetEntry> | undefined) ?? {};
    const custom = Object.keys(customRulesets).map((name) => ({
      id: name,
      label: name,
      isCustom: true,
    }));
    return [...builtIn, ...custom];
  };

  this.toggle = () => {
    this._active = !this._active;
    this.settings.set('bpmnLinter.enabled', this._active);
    if (this._active) {
      if (shouldLintCurrentDiagram()) {
        this._scheduleLint();
      } else {
        this.clearFindings();
        this.paneLayout.requestUpdate();
      }
    } else {
      this.clearFindings();
    }
    this._renderBadge();
    eventBus.fire('lintBridge.toggled', { active: this._active });
  };

  this.clearFindings = () => {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this.engine.clearFindings();
    this.overlayManager.clear();
    this._lastCounts = { errors: 0, warnings: 0, infos: 0 };
    this._lastScoreSnapshot = null;
    this.paneLayout.updateCounts(this._lastCounts);
    this.paneLayout.requestUpdate();
    this._renderBadge();

    const uri = this._boundDocumentUri ?? this._getDocumentUri();
    if (uri) {
      this.diagnosticsMediator.setDiagnostics(uri, DIAGNOSTICS_OWNER, []);
    }
  };

  this.getFindings = () => this.engine.getFindings();
  this.getCounts = () => this._lastCounts;
  this.getLintScoreSnapshot = () => this._lastScoreSnapshot;

  this.selectElement = (elementId: string, addToSelection?: boolean) => {
    try {
      const element = elementRegistry.get(elementId);
      if (!element) {
        return;
      }

      if (!addToSelection) {
        const viewbox = canvas.viewbox();
        const bounds = { x: element.x, y: element.y, width: element.width, height: element.height };
        canvas.viewbox({
          x: bounds.x + bounds.width / 2 - viewbox.outer.width / 2,
          y: bounds.y + bounds.height / 2 - viewbox.outer.height / 2,
          width: viewbox.outer.width,
          height: viewbox.outer.height,
        });
        canvas.zoom(1);
      }

      selection.select(element, addToSelection);
    } catch {
      // Element may not exist on canvas
    }
  };

  this.highlightElement = (elementId: string) => {
    if (this._highlightedElementId) {
      this.unhighlightElement(this._highlightedElementId);
    }
    try {
      canvas.addMarker(elementId, HIGHLIGHT_MARKER);
      this._highlightedElementId = elementId;
    } catch {
      // Element may not exist on canvas
    }
  };

  this.unhighlightElement = (elementId: string) => {
    try {
      canvas.removeMarker(elementId, HIGHLIGHT_MARKER);
    } catch {
      // Ignore
    }
    if (this._highlightedElementId === elementId) {
      this._highlightedElementId = null;
    }
  };

  this.getSelectedElementIds = () => this._selectedElementIds;

  this.getDiagramOrigin = () => this._diagramOrigin;

  this.isForeignDiagramLintingBlocked = () => {
    if (!this._diagramOrigin) {
      return false;
    }
    if (this._diagramOrigin.origin === 'daemon-engine') {
      return false;
    }
    if (this._foreignLintingAllowed) {
      return false;
    }
    return this.settings.get('bpmnLinter.alwaysLintForeignDiagrams') !== true;
  };

  this.allowForeignLinting = () => {
    this._foreignLintingAllowed = true;
    if (this._active) {
      this._scheduleLint();
    }
    this.paneLayout.requestUpdate();
  };

  const shouldLintCurrentDiagram = (): boolean => {
    if (!this._diagramOrigin) {
      return true;
    }
    if (this._diagramOrigin.origin === 'daemon-engine') {
      return true;
    }
    if (this._foreignLintingAllowed) {
      return true;
    }
    return this.settings.get('bpmnLinter.alwaysLintForeignDiagrams') === true;
  };

  eventBus.on('selection.changed', (event: { newSelection?: { id?: string }[] }) => {
    this._selectedElementIds = (event.newSelection ?? []).map((el) => el.id).filter(Boolean) as string[];
  });

  this._getDocumentUri = () => {
    const doc = this.editorsMediator.getFocusedEditorDocument();
    return doc?.uri ?? null;
  };

  this._bindDocumentUri = () => {
    if (this._boundDocumentUri) {
      return this._boundDocumentUri;
    }
    const uri = this._getDocumentUri();
    if (uri) {
      this._boundDocumentUri = uri;
    }
    return this._boundDocumentUri;
  };

  this._scheduleLint = () => {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    const delay = (this.settings.get('bpmnLinter.autoLintDelay') as number | undefined) ?? DEFAULT_DEBOUNCE_MS;
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._runLint();
    }, delay);
  };

  this._runLint = async () => {
    if (!this._active) {
      return;
    }

    try {
      const rootShape = canvas.getRootElement();
      if (!rootShape) {
        return;
      }

      const definitions = getDefinitionsBusinessObject(rootShape);
      if (!definitions) {
        return;
      }

      const freshOrigin = detectBpmnOrigin(definitions);
      if (
        freshOrigin.origin !== this._diagramOrigin?.origin ||
        freshOrigin.provider !== this._diagramOrigin?.provider
      ) {
        this._diagramOrigin = freshOrigin;
        this.paneLayout.requestUpdate();
      }

      const findings = await this.engine.lint(definitions, elementRegistry);

      this.overlayManager.update(findings);
      this._lastCounts = this.engine.getCounts();
      const snapshot = computeLintScore({
        findings,
        elementRegistry,
        rootElementId: rootShape?.id ?? null,
        scorePolicy: this._resolvedScorePolicy,
      });
      this._lastScoreSnapshot = snapshot;

      const newScore: EvilLinterRulesetScorePayload = {
        rulesetId: this.getActiveProfile(),
        scorePercent: String(snapshot.scorePercent),
        complianceStatus: snapshot.complianceStatus,
        computedAtIso: new Date().toISOString(),
        schemaVersion: String(snapshot.schemaVersion),
        maxPoints: String(snapshot.maxPoints),
        penaltyPoints: String(snapshot.penaltyPoints),
        rawErrorFindings: String(snapshot.rawFindingErrors),
        rawWarningFindings: String(snapshot.rawFindingWarnings),
      };

      const existingScore = readExistingScore(definitions, newScore.rulesetId);
      if (!scoreMatchesExisting(newScore, existingScore)) {
        try {
          this._lintScheduleSuppressionCount += 1;
          this.commandStack.execute(BFR_LINTER_RULESET_SCORE_COMMAND, {
            element: rootShape,
            definitions,
            score: newScore,
            lintScoresSilent: true,
          });
          this.eventBus.fire('elements.changed', { elements: [rootShape] });
        } catch (persistErr) {
          console.error('[bpmn-linter] Failed to persist linter score:', persistErr);
        } finally {
          queueMicrotask(() => {
            this._lintScheduleSuppressionCount = Math.max(0, this._lintScheduleSuppressionCount - 1);
          });
        }
      }

      this.paneLayout.updateCounts(this._lastCounts);
      this.paneLayout.requestUpdate();
      this._renderBadge();
      this._pushDiagnostics(findings);
    } catch (err) {
      console.error('[bpmn-linter] Lint run failed:', err);
    }
  };

  this._pushDiagnostics = (findings: LintFinding[]) => {
    const uri = this._bindDocumentUri();
    if (!uri) {
      return;
    }

    const diagnostics = findings.map((finding) => ({
      severity: finding.severity as 'error' | 'warning' | 'info',
      message: finding.elementName ? `[${finding.elementName}] ${finding.message}` : finding.message,
      source: DIAGNOSTICS_OWNER,
    }));

    this.diagnosticsMediator.setDiagnostics(uri, DIAGNOSTICS_OWNER, diagnostics);
  };

  this._renderBadge = () => {
    if (!this._badgeRoot) {
      return;
    }

    this._badgeRoot.render(
      React.createElement(ErrorSummaryBadge, {
        counts: this._lastCounts,
        scoreSnapshot: this._lastScoreSnapshot,
        isActive: this._active,
        foreignLintingBlocked: this.isForeignDiagramLintingBlocked(),
        onShowProblemsPane: () => {
          this.paneLayout.showProblemsPane();
        },
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
    this._badgeContainer.className = 'lint-badge-container';
    editorContent.appendChild(this._badgeContainer);
    this._badgeRoot = ReactDOM.createRoot(this._badgeContainer);

    this._renderBadge();
  };

  eventBus.on('canvas.init', () => {
    mountBadge();
  });

  eventBus.on('attach', () => {
    if (this._badgeContainer && !document.contains(this._badgeContainer)) {
      mountBadge();
    }
  });

  const scheduleLintAfterDiagramChange = () => {
    if (this._lintScheduleSuppressionCount > 0) {
      return;
    }
    if (this._active && shouldLintCurrentDiagram()) {
      this._scheduleLint();
    }
  };

  // Prefer broad hooks: some Studio / bpmn-js paths update the diagram without reliably emitting
  // `commandStack.changed` on the same bus the bridge sees, or listeners can be missed during
  // early lifecycle. Debouncing in `_scheduleLint` collapses duplicate signals.
  eventBus.on('commandStack.changed', scheduleLintAfterDiagramChange);
  eventBus.on('elements.changed', scheduleLintAfterDiagramChange);
  eventBus.on('element.changed', scheduleLintAfterDiagramChange);
  eventBus.on('shape.added', scheduleLintAfterDiagramChange);
  eventBus.on('shape.removed', scheduleLintAfterDiagramChange);
  eventBus.on('connection.added', scheduleLintAfterDiagramChange);
  eventBus.on('connection.removed', scheduleLintAfterDiagramChange);

  eventBus.on('import.done', () => {
    this._bindDocumentUri();
    const rootShape = canvas.getRootElement();
    const definitions = getDefinitionsBusinessObject(rootShape);
    this._diagramOrigin = definitions ? detectBpmnOrigin(definitions) : null;
    this._foreignLintingAllowed = false;

    if (this._active) {
      if (shouldLintCurrentDiagram()) {
        if (this._diagramOrigin && this._diagramOrigin.origin !== 'daemon-engine') {
          console.info(`[bpmn-linter] Linting foreign diagram (origin: ${this._diagramOrigin.provider})`);
        }
        this._scheduleLint();
      } else {
        this.clearFindings();
        this.paneLayout.requestUpdate();
      }
    }
  });

  eventBus.on('document.saved', () => {
    const rootShape = canvas.getRootElement();
    const definitions = getDefinitionsBusinessObject(rootShape);
    if (definitions) {
      const freshOrigin = detectBpmnOrigin(definitions);
      if (
        freshOrigin.origin !== this._diagramOrigin?.origin ||
        freshOrigin.provider !== this._diagramOrigin?.provider
      ) {
        this._diagramOrigin = freshOrigin;
        this._renderBadge();
        this.paneLayout.requestUpdate();
      }
    }
  });

  eventBus.on('diagram.destroy', () => {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this.overlayManager.clear();
    this._destroyBadge();

    const uri = this._boundDocumentUri;
    if (uri) {
      this.diagnosticsMediator.setDiagnostics(uri, DIAGNOSTICS_OWNER, []);
    }
    this._boundDocumentUri = null;
  });

  const settingsSub = this.settings.onSettingsUpdate((key: string) => {
    if (key === 'bpmnLinter.enabled') {
      const newState = this.settings.get('bpmnLinter.enabled') as boolean;
      if (newState !== this._active) {
        this._active = newState;
        if (this._active) {
          if (shouldLintCurrentDiagram()) {
            this._scheduleLint();
          } else {
            this.clearFindings();
            this.paneLayout.requestUpdate();
          }
        } else {
          this.clearFindings();
        }
        this._renderBadge();
        eventBus.fire('lintBridge.toggled', { active: this._active });
      }
    } else if (key === 'bpmnLinter.profile' || key === 'bpmnLinter.customRulesets') {
      applyProfile();
      if (this._active && shouldLintCurrentDiagram()) {
        this._scheduleLint();
      }
    } else if (key === 'bpmnLinter.alwaysLintForeignDiagrams') {
      if (this._active && shouldLintCurrentDiagram()) {
        this._scheduleLint();
      }
      this.paneLayout.requestUpdate();
    }
  });

  eventBus.on('diagram.destroy', () => {
    settingsSub.dispose();
  });
}

// diagram-js injection metadata — no typed alternative exists
(LintBridge as any).$inject = [
  'eventBus',
  'canvas',
  'elementRegistry',
  'overlays',
  'selection',
  'commandStack',
  'lintBridgeSettings',
  'lintBridgeDiagnostics',
  'lintBridgeEditors',
  'lintBridgePaneLayout',
];
