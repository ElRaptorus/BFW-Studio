import ReactDOM from 'react-dom/client';

import React from 'react';

import { BoundaryEventCheckbox } from './components/BoundaryEventCheckbox';
import { ElementPlayButton } from './components/ElementPlayButton';
import { GatewayChoiceOverlay } from './components/GatewayChoiceOverlay';
import { GatewayConfigButton } from './components/GatewayConfigButton';
import { InclusiveGatewayChoiceOverlay } from './components/InclusiveGatewayChoiceOverlay';
import { MultiInstanceConfigButton } from './components/MultiInstanceConfigButton';
import {
  type SimulationLogEntry,
  SimulationToolbar,
  type SimulationToolbarProps,
} from './components/SimulationToolbar';
import { SimulationEngine, type SimulationEvent, type SimulationMode } from './core/SimulationEngine';
import { registerAllBehaviors } from './core/behaviors';
import { isErrorEvent, isEscalationEvent } from './core/eventDefUtils';
import type { TokenSimSettingsAccessor } from './index';
import { ElementHighlighter } from './visual/ElementHighlighter';
import { FlowAnimator } from './visual/FlowAnimator';
import { TokenRenderer } from './visual/TokenRenderer';

export interface TokenSimulationBridgeServices {
  canvas: any;
  elementRegistry: any;
  overlays: any;
  eventBus: any;
  tokenSimSettings: TokenSimSettingsAccessor;
}

interface OverlayEntry {
  overlayId: string;
  elementId: string;
  root: ReactDOM.Root | null;
}

type StartContext = { type: 'global' } | { type: 'element'; processElement: any; startEvent: any };

export class TokenSimulationController {
  private canvas: any;
  private elementRegistry: any;
  private overlays: any;
  private eventBus: any;

  private engine: SimulationEngine;
  private tokenRenderer: TokenRenderer;
  private flowAnimator: FlowAnimator;
  private highlighter: ElementHighlighter;

  private active = false;
  private running = false;
  private paused = false;

  private toolbarRoot: ReactDOM.Root | null = null;
  private toolbarContainer: HTMLDivElement | null = null;
  private activeOverlays: OverlayEntry[] = [];
  private startEventOverlays: OverlayEntry[] = [];
  private gatewayConfigOverlays: OverlayEntry[] = [];
  private gatewayPreferences = new Map<string, any>();
  private boundaryConfigOverlays: OverlayEntry[] = [];
  private boundaryPreferences = new Map<string, boolean>();
  private eventGatewayFlows = new Map<string, any>();
  private lastStartContext: StartContext | null = null;
  private onDeactivated: (() => void) | null = null;

  private elementVisitCounts = new Map<string, number>();
  private counterOverlays: OverlayEntry[] = [];
  private showCounters = false;

  private multiInstanceConfig = new Map<string, number>();
  private multiInstanceConfigOverlays: OverlayEntry[] = [];

  private simulationLog: SimulationLogEntry[] = [];
  private logStartTime = 0;
  private showLog = false;

  private tooltipElement: HTMLDivElement | null = null;
  private boundHandleElementHover: ((event: any) => void) | null = null;
  private boundHandleElementOut: (() => void) | null = null;
  private boundHandleKeyDown: ((event: KeyboardEvent) => void) | null = null;

  private settings: TokenSimSettingsAccessor;

  constructor(bridge: TokenSimulationBridgeServices, onDeactivated?: () => void) {
    this.onDeactivated = onDeactivated ?? null;
    this.canvas = bridge.canvas;
    this.elementRegistry = bridge.elementRegistry;
    this.overlays = bridge.overlays;
    this.eventBus = bridge.eventBus;
    this.settings = bridge.tokenSimSettings;

    this.engine = new SimulationEngine(this.elementRegistry);
    this.tokenRenderer = new TokenRenderer(this.canvas);
    this.flowAnimator = new FlowAnimator(this.canvas);
    this.highlighter = new ElementHighlighter(this.elementRegistry);

    registerAllBehaviors(this.engine);
    this.engine.on(this.handleSimulationEvent);
  }

  isActive(): boolean {
    return this.active;
  }

  activate(): void {
    this.active = true;
    this.applyPersistedSettings();

    const container: HTMLElement = this.canvas.getContainer();
    container.closest('.bjs-container')?.classList.add('token-simulation');

    this.createToolbar();
    this.renderToolbar();
    this.showStartEventOverlays();
    this.showMultiInstanceConfigOverlays();
    this.registerHoverTooltips();
    this.registerKeyboardShortcuts();
  }

  private applyPersistedSettings(): void {
    const mode = this.settings.get('tokenSimulator.toolbar.mode') as SimulationMode | undefined;
    if (mode === 'auto' || mode === 'step') {
      this.engine.setMode(mode);
    }

    const speed = this.settings.get('tokenSimulator.toolbar.speed') as number | undefined;
    if (typeof speed === 'number' && speed >= 0.1 && speed <= 5.0) {
      this.engine.setSpeed(speed);
    }

    const showCounters = this.settings.get('tokenSimulator.toolbar.showCounters');
    if (typeof showCounters === 'boolean') {
      this.showCounters = showCounters;
    }

    const showLog = this.settings.get('tokenSimulator.toolbar.showLog');
    if (typeof showLog === 'boolean') {
      this.showLog = showLog;
    }
  }

  deactivate(): void {
    this.engine.reset();
    this.cleanup();
    this.clearStartEventOverlays();
    this.clearGatewayConfigOverlays();
    this.clearBoundaryConfigOverlays();
    this.clearCounterOverlays();
    this.clearMultiInstanceConfigOverlays();
    this.gatewayPreferences.clear();
    this.boundaryPreferences.clear();
    this.eventGatewayFlows.clear();
    this.elementVisitCounts.clear();
    this.multiInstanceConfig.clear();
    this.simulationLog = [];
    this.showLog = false;
    this.showCounters = false;
    this.active = false;
    this.running = false;
    this.paused = false;
    this.lastStartContext = null;

    this.unregisterHoverTooltips();
    this.unregisterKeyboardShortcuts();

    const container: HTMLElement = this.canvas.getContainer();
    container.closest('.bjs-container')?.classList.remove('token-simulation');

    this.destroyToolbar();
  }

  dispose(): void {
    if (this.active) {
      this.deactivate();
    }
    this.engine.off(this.handleSimulationEvent);
  }

  private handleSimulationEvent = (event: SimulationEvent): void => {
    switch (event.type) {
      case 'token:enter': {
        if (event.element.type === 'bpmn:SubProcess' && event.element.collapsed !== true) {
          this.clearSubProcessVisuals(event.element);
        } else {
          this.tokenRenderer.addToken(event.element);
        }
        this.highlighter.markActive(event.element);
        this.showBoundaryEventOverlays(event.element, event.scope);

        const parallelMiCount = this.getParallelMiIterations(event.element);
        if (parallelMiCount > 0) {
          for (let i = 0; i < parallelMiCount; i++) {
            this.incrementVisitCount(event.element);
          }
        } else {
          this.incrementVisitCount(event.element);
        }

        this.appendLog('token:enter', event.element);
        break;
      }

      case 'token:exit': {
        const remainingTokens = event.scope.getTokenCount(event.element.id);
        if (remainingTokens > 0) {
          this.appendLog('token:exit', event.element);
          break;
        }
        this.tokenRenderer.removeTokensForElement(event.element.id);
        this.highlighter.markCompleted(event.element);
        this.highlighter.markVisited(event.element);
        this.removeOverlaysForElement(event.element.id);
        this.removeBoundaryPlayOverlays(event.element);
        this.appendLog('token:exit', event.element);
        break;
      }

      case 'flow:animate':
        this.flowAnimator.animate(event.connection, this.engine.getFlowDuration(event.connection), event.done);
        this.highlighter.markFlowVisited(event.connection);
        break;

      case 'element:waiting':
        this.addPlayButtonOverlay(event.element, event.scope);
        break;

      case 'gateway:choice':
        this.highlighter.clearFlows();
        this.appendLog('gateway:choice', event.element);
        if (this.applyExclusivePreference(event.element, event.scope)) {
          break;
        }
        this.addGatewayStepOverlay(event.element, event.scope, event.outgoing);
        break;

      case 'gateway:auto':
        this.highlighter.clearFlows();
        this.appendLog('gateway:auto', event.element);
        if (this.applyExclusivePreference(event.element, event.scope, event.cancel)) {
          break;
        }
        this.highlighter.markFlow(event.chosenFlow);
        break;

      case 'gateway:inclusive-choice':
        this.highlighter.clearFlows();
        this.appendLog('gateway:inclusive-choice', event.element);
        if (this.applyInclusivePreference(event.element, event.scope)) {
          break;
        }
        this.addInclusiveGatewayStepOverlay(event.element, event.scope, event.outgoing);
        break;

      case 'gateway:inclusive-auto':
        this.highlighter.clearFlows();
        this.appendLog('gateway:inclusive-auto', event.element);
        if (this.applyInclusivePreference(event.element, event.scope, event.cancel)) {
          break;
        }
        break;

      case 'gateway:event-based': {
        this.appendLog('gateway:event-based', event.element);
        this.highlighter.clearFlows();
        const prevFlow = this.eventGatewayFlows.get(event.element.id);
        if (prevFlow) {
          this.highlighter.clearPreferredFlow(prevFlow);
          this.eventGatewayFlows.delete(event.element.id);
        }
        this.tokenRenderer.addToken(event.element);
        this.addEventBasedGatewayOverlays(event.element, event.scope, event.catchEvents);
        break;
      }

      case 'message:send': {
        for (const flow of event.messageFlows) {
          this.highlighter.markMessageFlow(flow);
          this.flowAnimator.animate(
            flow,
            this.engine.getFlowDuration(flow),
            () => {
              if (flow.target) {
                this.highlighter.pulseElement(flow.target);
              }
            },
            'token-sim-message-flow-token',
          );
        }
        this.appendLog('message:send', event.element);
        break;
      }

      case 'signal:broadcast': {
        this.flowAnimator.showRipple(event.element, 800);
        for (const target of event.targets) {
          this.highlighter.pulseElement(target);
          if (target.type === 'bpmn:BoundaryEvent') {
            this.cleanupSignalBoundaryHost(target);
          }
        }
        this.appendLog('signal:broadcast', event.element);
        break;
      }

      case 'simulation:start':
        this.running = true;
        this.paused = false;
        this.logStartTime = Date.now();
        this.simulationLog = [];
        this.elementVisitCounts.clear();
        this.clearCounterOverlays();
        this.clearStartEventOverlays();
        this.showGatewayConfigOverlays();
        this.showBoundaryConfigOverlays();
        this.syncMultiInstanceConfigToEngine();
        this.appendLog('simulation:start');
        this.renderToolbar();
        break;

      case 'simulation:reset':
      case 'simulation:terminated':
        this.appendLog(event.type);
        this.handleSimulationEnd();
        break;

      case 'simulation:error-terminated':
        this.appendLog('simulation:error-terminated', event.element);
        this.handleSimulationEnd();
        this.highlighter.markError(event.element);
        break;

      case 'simulation:complete':
        this.appendLog('simulation:complete');
        this.renderToolbar();
        break;

      case 'scope:complete': {
        const completedScope = event.scope;
        if (completedScope.parent) {
          const container = completedScope.element;
          const children: any[] = container.children || [];
          for (const child of children) {
            this.tokenRenderer.fadeTokensForElement(child.id);
          }
        }
        break;
      }

      case 'simulation:pause':
        this.paused = true;
        this.flowAnimator.pause();
        this.renderToolbar();
        break;

      case 'simulation:resume':
        this.paused = false;
        this.flowAnimator.resume();
        this.renderToolbar();
        break;
    }
  };

  private startSimulation = (): void => {
    this.cleanup();
    this.lastStartContext = { type: 'global' };

    const rootElement = this.canvas.getRootElement();
    const processElements = this.getProcessElements(rootElement);

    if (processElements.length > 0) {
      this.engine.start(processElements[0]);
    }
  };

  private startProcessForElement(startEvent: any): void {
    this.cleanup();
    this.clearStartEventOverlays();

    const processElement = this.findParentProcess(startEvent);
    if (processElement) {
      this.lastStartContext = { type: 'element', processElement, startEvent };
      this.engine.startFromElement(processElement, startEvent);
    }
  }

  private replaySimulation = (): void => {
    if (!this.lastStartContext) {
      return;
    }

    const ctx = this.lastStartContext;
    const savedGatewayPrefs = new Map(this.gatewayPreferences);
    const savedBoundaryPrefs = new Map(this.boundaryPreferences);
    const savedMiConfig = new Map(this.multiInstanceConfig);

    if (ctx.type === 'element') {
      this.engine.startFromElement(ctx.processElement, ctx.startEvent);
    } else {
      const rootElement = this.canvas.getRootElement();
      const processElements = this.getProcessElements(rootElement);
      if (processElements.length > 0) {
        this.engine.start(processElements[0]);
      }
    }

    this.gatewayPreferences = savedGatewayPrefs;
    this.boundaryPreferences = savedBoundaryPrefs;
    this.multiInstanceConfig = savedMiConfig;
    this.eventGatewayFlows.clear();
    this.showGatewayConfigOverlays();
    this.showBoundaryConfigOverlays();
    this.showMultiInstanceConfigOverlays();
  };

  private resetSimulation = (): void => {
    this.engine.reset();
  };

  private togglePause = (): void => {
    if (this.paused) {
      this.engine.resume();
    } else {
      this.engine.pause();
    }
  };

  private setSpeed = (speed: number): void => {
    this.engine.setSpeed(speed);
    this.settings.set('tokenSimulator.toolbar.speed', speed);
    this.renderToolbar();
  };

  private setMode = (mode: SimulationMode): void => {
    this.engine.setMode(mode);
    this.settings.set('tokenSimulator.toolbar.mode', mode);
    this.renderToolbar();
  };

  private cleanup(): void {
    this.tokenRenderer.clear();
    this.flowAnimator.clear();
    this.highlighter.clear();
    this.clearOverlays();
  }

  private handleSimulationEnd(): void {
    this.cleanup();
    this.clearGatewayConfigOverlays();
    this.clearBoundaryConfigOverlays();
    this.clearCounterOverlays();
    this.gatewayPreferences.clear();
    this.boundaryPreferences.clear();
    this.eventGatewayFlows.clear();
    this.elementVisitCounts.clear();
    this.simulationLog = [];
    this.running = false;
    this.paused = false;
    this.renderToolbar();
    if (this.active) {
      this.showStartEventOverlays();
      this.showMultiInstanceConfigOverlays();
    }
  }

  // --- Overlay helpers ---

  private createOverlay(
    element: any,
    overlayType: string,
    position: Record<string, number>,
    reactElement: React.ReactElement,
    targetList: OverlayEntry[],
    elementId?: string,
  ): void {
    const container = document.createElement('div');
    container.style.pointerEvents = 'all';

    const root = ReactDOM.createRoot(container);
    root.render(reactElement);

    try {
      const overlayId = this.overlays.add(element, overlayType, { position, html: container });
      targetList.push({ overlayId, elementId: elementId ?? element.id, root });
    } catch {
      root.unmount();
    }
  }

  // --- Start event overlays ---

  private showStartEventOverlays(): void {
    const rootElement = this.canvas.getRootElement();
    const processElements = this.getProcessElements(rootElement);

    for (const processEl of processElements) {
      const startEvents = this.getStartEvents(processEl);
      for (const startEvent of startEvents) {
        this.addStartEventOverlay(startEvent);
      }
    }
  }

  private addStartEventOverlay(startEvent: any): void {
    this.createOverlay(
      startEvent,
      'token-sim-start',
      { top: -10, right: 5 },
      React.createElement(ElementPlayButton, {
        onContinue: () => this.startProcessForElement(startEvent),
      }),
      this.startEventOverlays,
    );
  }

  private clearStartEventOverlays(): void {
    for (const entry of this.startEventOverlays) {
      entry.root?.unmount();
      try {
        this.overlays.remove(entry.overlayId);
      } catch {
        // overlay may already be removed
      }
    }
    this.startEventOverlays = [];
  }

  private findParentProcess(element: any): any | null {
    const rootElement = this.canvas.getRootElement();
    const processElements = this.getProcessElements(rootElement);

    for (const processEl of processElements) {
      const children: any[] = processEl.children || [];
      if (children.some((child: any) => child.id === element.id)) {
        return processEl;
      }
    }

    return processElements[0] ?? null;
  }

  private getStartEvents(processElement: any): any[] {
    const children: any[] = processElement.children || [];
    return children.filter((child: any) => child.type === 'bpmn:StartEvent');
  }

  // --- Gateway path pre-configuration ---

  private showGatewayConfigOverlays(): void {
    this.clearGatewayConfigOverlays();
    const rootElement = this.canvas.getRootElement();
    const processElements = this.getProcessElements(rootElement);

    for (const processEl of processElements) {
      this.forEachFlowElement(processEl, (child) => {
        if (child.type !== 'bpmn:ExclusiveGateway' && child.type !== 'bpmn:InclusiveGateway') {
          return;
        }
        const outgoing = (child.outgoing || []).filter((connection: any) => connection.type === 'bpmn:SequenceFlow');
        if (outgoing.length <= 1) {
          return;
        }
        this.addGatewayConfigOverlay(child, outgoing);
        this.restorePreferredFlowHighlights(child, outgoing);
      });
    }
  }

  private addGatewayConfigOverlay(gateway: any, outgoing: any[]): void {
    const container = document.createElement('div');
    container.style.pointerEvents = 'all';

    const root = ReactDOM.createRoot(container);

    const renderButton = () => {
      root.render(
        React.createElement(GatewayConfigButton, {
          configured: this.gatewayPreferences.has(gateway.id),
          onConfigure: () => {
            this.openGatewayConfigPanel(gateway, outgoing, renderButton);
          },
        }),
      );
    };
    renderButton();

    try {
      const overlayId = this.overlays.add(gateway, 'token-sim-gw-config', {
        position: { top: -12, left: -2 },
        html: container,
      });
      this.gatewayConfigOverlays.push({ overlayId, elementId: gateway.id, root });
    } catch {
      root.unmount();
    }
  }

  private openGatewayConfigPanel(gateway: any, outgoing: any[], onDone: () => void): void {
    const existingConfig = this.activeOverlays.filter(
      (overlayEntry) => overlayEntry.elementId === `${gateway.id}__config`,
    );
    for (const entry of existingConfig) {
      entry.root?.unmount();
      try {
        this.overlays.remove(entry.overlayId);
      } catch {
        /* already removed */
      }
    }
    this.activeOverlays = this.activeOverlays.filter(
      (overlayEntry) => overlayEntry.elementId !== `${gateway.id}__config`,
    );

    const applyAndClose = (prefs: any, chosen: any[]) => {
      this.gatewayPreferences.set(gateway.id, prefs);
      this.highlightPreferredFlows(gateway.id, outgoing, chosen);
      this.removeConfigPanel(gateway.id);
      onDone();
    };

    const isInclusive = gateway.type === 'bpmn:InclusiveGateway';
    const existingPref = this.gatewayPreferences.get(gateway.id);
    const reactElement = isInclusive
      ? React.createElement(InclusiveGatewayChoiceOverlay, {
          outgoingFlows: outgoing,
          onChoose: (flows: any[]) => applyAndClose({ type: 'inclusive', flows }, flows),
          initialSelected:
            existingPref?.type === 'inclusive'
              ? new Set<string>(existingPref.flows.map((flow: any) => flow.id))
              : undefined,
        })
      : React.createElement(GatewayChoiceOverlay, {
          outgoingFlows: outgoing,
          onChoose: (flow: any) => applyAndClose({ type: 'exclusive', flow }, [flow]),
          initialSelectedId: existingPref?.type === 'exclusive' ? existingPref.flow?.id : undefined,
        });

    this.createOverlay(
      gateway,
      'token-sim-gw-config-panel',
      { bottom: 0, left: 0 },
      reactElement,
      this.activeOverlays,
      `${gateway.id}__config`,
    );
  }

  private removeConfigPanel(gatewayId: string): void {
    const panelId = `${gatewayId}__config`;
    const toRemove = this.activeOverlays.filter((overlayEntry) => overlayEntry.elementId === panelId);
    for (const entry of toRemove) {
      entry.root?.unmount();
      try {
        this.overlays.remove(entry.overlayId);
      } catch {
        /* already removed */
      }
    }
    this.activeOverlays = this.activeOverlays.filter((overlayEntry) => overlayEntry.elementId !== panelId);
  }

  private clearGatewayConfigOverlays(): void {
    for (const entry of this.gatewayConfigOverlays) {
      entry.root?.unmount();
      try {
        this.overlays.remove(entry.overlayId);
      } catch {
        /* already removed */
      }
    }
    this.gatewayConfigOverlays = [];
    this.highlighter.clearAllPreferredFlows();
  }

  // --- Boundary event config overlays ---

  private showBoundaryConfigOverlays(): void {
    this.clearBoundaryConfigOverlays();
    const rootElement = this.canvas.getRootElement();
    const processElements = this.getProcessElements(rootElement);

    for (const processEl of processElements) {
      this.forEachFlowElement(processEl, (child) => {
        const boundaryEvents = this.getBoundaryEvents(child);
        for (const be of boundaryEvents) {
          if (isErrorEvent(be) || isEscalationEvent(be)) {
            continue;
          }
          this.addBoundaryConfigOverlay(be);
        }
      });
    }
  }

  private addBoundaryConfigOverlay(boundaryEvent: any): void {
    const container = document.createElement('div');
    container.style.pointerEvents = 'all';

    const isInterrupting = boundaryEvent.businessObject?.cancelActivity !== false;
    const root = ReactDOM.createRoot(container);

    const renderCheckbox = () => {
      root.render(
        React.createElement(BoundaryEventCheckbox, {
          enabled: this.boundaryPreferences.get(boundaryEvent.id) === true,
          interrupting: isInterrupting,
          onToggle: () => {
            const current = this.boundaryPreferences.get(boundaryEvent.id) === true;
            if (current) {
              this.boundaryPreferences.delete(boundaryEvent.id);
            } else {
              this.boundaryPreferences.set(boundaryEvent.id, true);
            }
            renderCheckbox();
          },
        }),
      );
    };
    renderCheckbox();

    try {
      const overlayId = this.overlays.add(boundaryEvent, 'token-sim-boundary-config', {
        position: { top: -26, left: -2 },
        html: container,
      });
      this.boundaryConfigOverlays.push({ overlayId, elementId: boundaryEvent.id, root });
    } catch {
      root.unmount();
    }
  }

  private clearBoundaryConfigOverlays(): void {
    for (const entry of this.boundaryConfigOverlays) {
      entry.root?.unmount();
      try {
        this.overlays.remove(entry.overlayId);
      } catch {
        /* already removed */
      }
    }
    this.boundaryConfigOverlays = [];
  }

  // --- Multi-instance config overlays ---

  private showMultiInstanceConfigOverlays(): void {
    this.clearMultiInstanceConfigOverlays();
    const rootElement = this.canvas.getRootElement();
    const processElements = this.getProcessElements(rootElement);

    for (const processEl of processElements) {
      this.forEachFlowElement(processEl, (child) => {
        const lc = child.businessObject?.loopCharacteristics;
        if (!lc) {
          return;
        }
        this.addMultiInstanceConfigOverlay(child);
      });
    }
  }

  private addMultiInstanceConfigOverlay(element: any): void {
    const container = document.createElement('div');
    container.style.pointerEvents = 'all';
    const root = ReactDOM.createRoot(container);

    const renderButton = () => {
      const count = this.multiInstanceConfig.get(element.id) ?? 3;
      root.render(
        React.createElement(MultiInstanceConfigButton, {
          count,
          onChangeCount: (newCount: number) => {
            this.multiInstanceConfig.set(element.id, newCount);
            this.engine.setMultiInstanceCount(element.id, newCount);
            renderButton();
          },
        }),
      );
    };
    renderButton();

    try {
      const overlayId = this.overlays.add(element, 'token-sim-mi-config', {
        position: { bottom: 21, left: 1 },
        html: container,
      });
      this.multiInstanceConfigOverlays.push({ overlayId, elementId: element.id, root });
    } catch {
      root.unmount();
    }
  }

  private clearMultiInstanceConfigOverlays(): void {
    for (const entry of this.multiInstanceConfigOverlays) {
      entry.root?.unmount();
      try {
        this.overlays.remove(entry.overlayId);
      } catch {
        /* already removed */
      }
    }
    this.multiInstanceConfigOverlays = [];
  }

  private syncMultiInstanceConfigToEngine(): void {
    for (const [elementId, count] of this.multiInstanceConfig) {
      this.engine.setMultiInstanceCount(elementId, count);
    }
  }

  private highlightPreferredFlows(gatewayId: string, allOutgoing: any[], chosenFlows: any[]): void {
    for (const flow of allOutgoing) {
      this.highlighter.clearPreferredFlow(flow);
    }
    for (const flow of chosenFlows) {
      this.highlighter.markPreferredFlow(flow);
    }
  }

  private restorePreferredFlowHighlights(gateway: any, outgoing: any[]): void {
    const pref = this.gatewayPreferences.get(gateway.id);
    if (pref) {
      if (pref.type === 'exclusive' && pref.flow) {
        this.highlighter.markPreferredFlow(pref.flow);
      } else if (pref.type === 'inclusive' && pref.flows) {
        for (const flow of pref.flows) {
          this.highlighter.markPreferredFlow(flow);
        }
      }
      return;
    }

    if (gateway.type === 'bpmn:ExclusiveGateway') {
      const defaultFlowRef = gateway.businessObject?.default;
      const defaultFlow = defaultFlowRef
        ? (outgoing.find((flow: any) => flow.businessObject?.id === defaultFlowRef.id) ?? outgoing[0])
        : outgoing[0];
      if (defaultFlow) {
        this.highlighter.markPreferredFlow(defaultFlow);
      }
    } else if (gateway.type === 'bpmn:InclusiveGateway') {
      for (const flow of outgoing) {
        this.highlighter.markPreferredFlow(flow);
      }
    }
  }

  private applyExclusivePreference(element: any, scope: any, cancelAutoRoute?: () => void): boolean {
    const pref = this.gatewayPreferences.get(element.id);
    if (!pref || pref.type !== 'exclusive') {
      return false;
    }

    cancelAutoRoute?.();
    this.engine.emitTokenExit(element, scope);
    this.highlighter.markFlow(pref.flow);
    this.engine.animateFlow(pref.flow, scope, () => {
      this.engine.enter(pref.flow.target, scope, pref.flow);
    });
    return true;
  }

  private applyInclusivePreference(element: any, scope: any, cancelAutoRoute?: () => void): boolean {
    const pref = this.gatewayPreferences.get(element.id);
    if (!pref || pref.type !== 'inclusive') {
      return false;
    }

    cancelAutoRoute?.();
    const flowIds = new Set(pref.flows.map((flow: any) => flow.id));
    scope.setActivatedBranches(element.id, flowIds);

    this.engine.emitTokenExit(element, scope);
    for (const flow of pref.flows) {
      this.engine.animateFlow(flow, scope, () => {
        this.engine.enter(flow.target, scope, flow);
      });
    }
    return true;
  }

  // --- Runtime overlays (play buttons, gateway choices) ---

  private addPlayButtonOverlay(element: any, scope: any): void {
    this.createOverlay(
      element,
      'token-sim-play',
      { top: -10, right: 5 },
      React.createElement(ElementPlayButton, {
        onContinue: () => {
          this.removeOverlaysForElement(element.id);
          this.engine.trigger(element, scope);
        },
      }),
      this.activeOverlays,
    );
  }

  private addGatewayStepOverlay(element: any, scope: any, outgoing: any[]): void {
    this.createOverlay(
      element,
      'token-sim-step',
      { top: -10, right: 5 },
      React.createElement(ElementPlayButton, {
        onContinue: () => {
          const pref = this.gatewayPreferences.get(element.id);
          const chosenFlow = pref?.type === 'exclusive' ? pref.flow : this.getDefaultExclusiveFlow(element, outgoing);
          this.removeOverlaysForElement(element.id);
          this.engine.trigger(element, scope, { chosenFlow });
        },
      }),
      this.activeOverlays,
    );
  }

  // --- Boundary event overlays ---

  private showBoundaryEventOverlays(hostElement: any, scope: any): void {
    const boundaryEvents = this.getBoundaryEvents(hostElement);
    if (boundaryEvents.length === 0) {
      return;
    }

    if (this.engine.mode === 'auto') {
      this.applyBoundaryPreferences(hostElement, boundaryEvents, scope);
    } else {
      for (const boundaryEvent of boundaryEvents) {
        this.addBoundaryPlayOverlay(boundaryEvent, hostElement, scope);
      }
    }
  }

  private applyBoundaryPreferences(hostElement: any, boundaryEvents: any[], scope: any): void {
    for (const boundaryEvent of boundaryEvents) {
      if (!this.boundaryPreferences.get(boundaryEvent.id)) {
        continue;
      }

      const isInterrupting = boundaryEvent.businessObject?.cancelActivity !== false;

      this.engine.scheduleDelay(() => {
        if (isInterrupting) {
          this.engine.cancelElement(hostElement, scope);
          this.tokenRenderer.removeTokensForElement(hostElement.id);
          this.removeOverlaysForElement(hostElement.id);
          this.removeBoundaryPlayOverlays(hostElement);
          if (hostElement.type === 'bpmn:SubProcess') {
            this.clearSubProcessVisuals(hostElement);
          }
        }

        const outgoing = (boundaryEvent.outgoing || []).filter(
          (connection: any) => connection.type === 'bpmn:SequenceFlow',
        );
        for (const connection of outgoing) {
          this.engine.animateFlow(connection, scope, () => {
            this.engine.enter(connection.target, scope, connection);
          });
        }
      }, this.engine.getTaskDelay());
    }
  }

  private addBoundaryPlayOverlay(boundaryEvent: any, hostElement: any, scope: any): void {
    const isInterrupting = boundaryEvent.businessObject?.cancelActivity !== false;

    this.createOverlay(
      boundaryEvent,
      'token-sim-boundary',
      { top: -10, right: 5 },
      React.createElement(ElementPlayButton, {
        onContinue: () => {
          this.removeBoundaryPlayOverlays(hostElement);

          if (isInterrupting) {
            this.engine.cancelElement(hostElement, scope);
            this.tokenRenderer.removeTokensForElement(hostElement.id);
            this.removeOverlaysForElement(hostElement.id);
            if (hostElement.type === 'bpmn:SubProcess') {
              this.clearSubProcessVisuals(hostElement);
            }
          }

          const outgoing = (boundaryEvent.outgoing || []).filter(
            (connection: any) => connection.type === 'bpmn:SequenceFlow',
          );
          for (const connection of outgoing) {
            this.engine.animateFlow(connection, scope, () => {
              this.engine.enter(connection.target, scope, connection);
            });
          }
        },
      }),
      this.activeOverlays,
    );
  }

  private removeBoundaryPlayOverlays(hostElement: any): void {
    const boundaryEvents = this.getBoundaryEvents(hostElement);
    for (const be of boundaryEvents) {
      this.removeOverlaysForElement(be.id);
    }
  }

  private getBoundaryEvents(element: any): any[] {
    const attachers: any[] = element.attachers || [];
    return attachers.filter((attacher: any) => attacher.type === 'bpmn:BoundaryEvent');
  }

  private cleanupSignalBoundaryHost(boundaryEvent: any): void {
    const isInterrupting = boundaryEvent.businessObject?.cancelActivity !== false;
    if (!isInterrupting) {
      return;
    }

    const hostRef = boundaryEvent.businessObject?.attachedToRef;
    if (!hostRef) {
      return;
    }

    const hostElement = this.elementRegistry.get(hostRef.id);
    if (!hostElement) {
      return;
    }

    this.tokenRenderer.removeTokensForElement(hostElement.id);
    this.removeOverlaysForElement(hostElement.id);
    this.removeBoundaryPlayOverlays(hostElement);
    if (hostElement.type === 'bpmn:SubProcess') {
      this.clearSubProcessVisuals(hostElement);
    }
  }

  private clearSubProcessVisuals(element: any): void {
    const childIds = new Set<string>();
    const childElements: any[] = [];
    this.collectDescendants(element, childIds, childElements);

    for (const child of childElements) {
      this.tokenRenderer.removeTokensForElement(child.id);
      this.removeOverlaysForElement(child.id);
      this.highlighter.clearElement(child);
    }

    this.flowAnimator.cancelForElements(childIds);
  }

  private collectDescendants(element: any, ids: Set<string>, elements: any[]): void {
    const children: any[] = element.children || [];
    for (const child of children) {
      ids.add(child.id);
      elements.push(child);
      if (child.children) {
        this.collectDescendants(child, ids, elements);
      }
    }
  }

  // --- Inclusive gateway step overlay ---

  private addInclusiveGatewayStepOverlay(element: any, scope: any, outgoing: any[]): void {
    this.createOverlay(
      element,
      'token-sim-inclusive-step',
      { top: -10, right: 5 },
      React.createElement(ElementPlayButton, {
        onContinue: () => {
          const pref = this.gatewayPreferences.get(element.id);
          const chosenFlows = pref?.type === 'inclusive' ? pref.flows : outgoing;
          this.removeOverlaysForElement(element.id);
          this.engine.trigger(element, scope, { chosenFlows });
        },
      }),
      this.activeOverlays,
    );
  }

  // --- Event-based gateway overlays ---

  private addEventBasedGatewayOverlays(gatewayElement: any, scope: any, catchEvents: any[]): void {
    const allCatchIds = catchEvents.map((e: any) => e.id);
    const outgoingFlows: any[] = (gatewayElement.outgoing || []).filter(
      (connection: any) => connection.type === 'bpmn:SequenceFlow',
    );
    let cancelled = false;

    const cleanupAll = () => {
      for (const id of allCatchIds) {
        this.removeOverlaysForElement(id);
      }
      this.removeOverlaysForElement(gatewayElement.id);
    };

    const highlightChosenPath = (chosenCatchEvent: any) => {
      const flow = outgoingFlows.find((outgoingFlow: any) => outgoingFlow.target?.id === chosenCatchEvent.id);
      if (flow) {
        this.highlighter.markPreferredFlow(flow);
        this.eventGatewayFlows.set(gatewayElement.id, flow);
      }
    };

    const triggerCatchEvent = (catchEvent: any) => {
      cancelled = true;
      cleanupAll();
      this.tokenRenderer.removeTokensForElement(gatewayElement.id);
      highlightChosenPath(catchEvent);
      this.tokenRenderer.addToken(catchEvent);
      this.highlighter.markActive(catchEvent);
      this.incrementVisitCount(catchEvent);
      this.engine.scheduleDelay(() => {
        if (scope.state !== 'running') {
          return;
        }
        this.tokenRenderer.removeTokensForElement(catchEvent.id);
        this.highlighter.markCompleted(catchEvent);
        this.engine.routeToOutgoing(catchEvent, scope);
      }, this.engine.getTaskDelay());
    };

    if (this.engine.mode === 'step') {
      for (const catchEvent of catchEvents) {
        this.createOverlay(
          catchEvent,
          'token-sim-event-gw',
          { top: -10, right: 5 },
          React.createElement(ElementPlayButton, {
            onContinue: () => triggerCatchEvent(catchEvent),
          }),
          this.activeOverlays,
        );
      }
    } else {
      const randomIndex = Math.floor(Math.random() * catchEvents.length);
      this.engine.scheduleDelay(() => {
        if (cancelled) {
          return;
        }
        triggerCatchEvent(catchEvents[randomIndex]);
      }, this.engine.getTaskDelay());
    }
  }

  private removeOverlaysForElement(elementId: string): void {
    const toRemove = this.activeOverlays.filter((overlayEntry) => overlayEntry.elementId === elementId);
    for (const entry of toRemove) {
      entry.root?.unmount();
      try {
        this.overlays.remove(entry.overlayId);
      } catch {
        // overlay may already be removed
      }
    }
    this.activeOverlays = this.activeOverlays.filter((overlayEntry) => overlayEntry.elementId !== elementId);
  }

  private clearOverlays(): void {
    for (const entry of this.activeOverlays) {
      entry.root?.unmount();
      try {
        this.overlays.remove(entry.overlayId);
      } catch {
        // overlay may already be removed
      }
    }
    this.activeOverlays = [];
  }

  // --- Toolbar ---

  private createToolbar(): void {
    if (this.toolbarContainer) {
      return;
    }

    const bpmnContainer: HTMLElement = this.canvas.getContainer();
    const editorContent = bpmnContainer.closest('.editor__content') || bpmnContainer.parentElement;
    if (!editorContent) {
      return;
    }

    this.toolbarContainer = document.createElement('div');
    this.toolbarContainer.className = 'token-sim-toolbar-container';
    editorContent.appendChild(this.toolbarContainer);
    this.toolbarRoot = ReactDOM.createRoot(this.toolbarContainer);
  }

  private renderToolbar(): void {
    if (!this.toolbarRoot) {
      return;
    }

    const toolbarProps: SimulationToolbarProps = {
      isRunning: this.running,
      isPaused: this.paused,
      mode: this.engine.mode,
      speed: this.engine.speed,
      showCounters: this.showCounters,
      showLog: this.showLog,
      hasTraceData: this.simulationLog.length > 0,
      logEntries: this.simulationLog,
      onStart: this.startSimulation,
      onReplay: this.replaySimulation,
      onReset: this.resetSimulation,
      onPauseResume: this.togglePause,
      onSpeedChange: this.setSpeed,
      onModeChange: this.setMode,
      onToggleCounters: this.toggleCounters,
      onToggleLog: this.toggleLog,
      onExportTrace: this.exportTrace,
      onClose: () => {
        this.deactivate();
        this.onDeactivated?.();
      },
    };

    this.toolbarRoot.render(React.createElement(SimulationToolbar, toolbarProps));
  }

  private destroyToolbar(): void {
    this.toolbarRoot?.unmount();
    this.toolbarRoot = null;
    this.toolbarContainer?.remove();
    this.toolbarContainer = null;
  }

  remountToolbar(): void {
    this.toolbarRoot?.unmount();
    this.toolbarRoot = null;
    this.toolbarContainer = null;
    this.createToolbar();
    this.renderToolbar();
  }

  // --- Token counters ---

  private incrementVisitCount(element: any): void {
    const count = (this.elementVisitCounts.get(element.id) ?? 0) + 1;
    this.elementVisitCounts.set(element.id, count);
    if (this.showCounters) {
      this.updateCounterOverlay(element, count);
    }
  }

  private updateCounterOverlay(element: any, count: number): void {
    this.removeCounterOverlay(element.id);

    const badge = document.createElement('span');
    badge.className = 'token-sim-counter-badge';
    badge.textContent = String(count);

    const container = document.createElement('div');
    container.style.pointerEvents = 'none';
    container.appendChild(badge);

    try {
      const overlayId = this.overlays.add(element, 'token-sim-counter', {
        position: { bottom: 10, right: 5 },
        html: container,
      });
      this.counterOverlays.push({ overlayId, elementId: element.id, root: null });
    } catch {
      /* element may have been removed */
    }
  }

  private removeCounterOverlay(elementId: string): void {
    const idx = this.counterOverlays.findIndex((e) => e.elementId === elementId);
    if (idx >= 0) {
      try {
        this.overlays.remove(this.counterOverlays[idx].overlayId);
      } catch {
        /* already removed */
      }
      this.counterOverlays.splice(idx, 1);
    }
  }

  private clearCounterOverlays(): void {
    for (const entry of this.counterOverlays) {
      try {
        this.overlays.remove(entry.overlayId);
      } catch {
        /* already removed */
      }
    }
    this.counterOverlays = [];
  }

  private toggleCounters = (): void => {
    this.showCounters = !this.showCounters;
    this.settings.set('tokenSimulator.toolbar.showCounters', this.showCounters);
    if (this.showCounters) {
      for (const [elementId, count] of this.elementVisitCounts) {
        const element = this.elementRegistry.get(elementId);
        if (element) {
          this.updateCounterOverlay(element, count);
        }
      }
    } else {
      this.clearCounterOverlays();
    }
    this.renderToolbar();
  };

  // --- Simulation log ---

  private appendLog(eventType: string, element?: any): void {
    this.simulationLog.push({
      id: crypto.randomUUID(),
      time: this.logStartTime > 0 ? Date.now() - this.logStartTime : 0,
      event: eventType,
      elementId: element?.id ?? '',
      elementName: element?.businessObject?.name || element?.id || '',
    });
    if (this.showLog) {
      this.renderToolbar();
    }
  }

  private toggleLog = (): void => {
    this.showLog = !this.showLog;
    this.settings.set('tokenSimulator.toolbar.showLog', this.showLog);
    this.renderToolbar();
  };

  private exportTrace = (): void => {
    if (this.simulationLog.length === 0) {
      return;
    }

    const json = JSON.stringify(this.simulationLog, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `simulation-trace-${Date.now()}.json`;
    downloadLink.click();
    URL.revokeObjectURL(url);
  };

  // --- Hover tooltips ---

  private registerHoverTooltips(): void {
    this.boundHandleElementHover = (event: any) => {
      if (!this.running) {
        return;
      }
      const element = event.element;
      if (!element || element.type === 'bpmn:SequenceFlow' || element.type === 'label') {
        return;
      }

      const name = element.businessObject?.name || element.id;
      const type = this.humanReadableType(element.type);
      const visits = this.elementVisitCounts.get(element.id) ?? 0;

      this.showTooltip(event.originalEvent, `${name} — ${type}${visits > 0 ? ` (${visits}×)` : ''}`);
    };
    this.boundHandleElementOut = () => this.hideTooltip();

    this.eventBus.on('element.hover', this.boundHandleElementHover);
    this.eventBus.on('element.out', this.boundHandleElementOut);
  }

  private unregisterHoverTooltips(): void {
    if (this.boundHandleElementHover) {
      this.eventBus.off('element.hover', this.boundHandleElementHover);
    }
    if (this.boundHandleElementOut) {
      this.eventBus.off('element.out', this.boundHandleElementOut);
    }
    this.boundHandleElementHover = null;
    this.boundHandleElementOut = null;
    this.hideTooltip();
  }

  private showTooltip(mouseEvent: MouseEvent, text: string): void {
    this.hideTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'token-sim-tooltip';
    tooltip.textContent = text;

    const bpmnContainer: HTMLElement = this.canvas.getContainer();
    const editorContent = bpmnContainer.closest('.editor__content') || bpmnContainer.parentElement;
    if (!editorContent) {
      return;
    }

    const rect = (editorContent as HTMLElement).getBoundingClientRect();
    tooltip.style.left = `${mouseEvent.clientX - rect.left + 12}px`;
    tooltip.style.top = `${mouseEvent.clientY - rect.top + 12}px`;

    (editorContent as HTMLElement).appendChild(tooltip);
    this.tooltipElement = tooltip;
  }

  private hideTooltip(): void {
    this.tooltipElement?.remove();
    this.tooltipElement = null;
  }

  private humanReadableType(bpmnType: string): string {
    const map: Record<string, string> = {
      'bpmn:StartEvent': 'Start Event',
      'bpmn:EndEvent': 'End Event',
      'bpmn:Task': 'Task',
      'bpmn:UserTask': 'User Task',
      'bpmn:ServiceTask': 'Service Task',
      'bpmn:ScriptTask': 'Script Task',
      'bpmn:SendTask': 'Send Task',
      'bpmn:ReceiveTask': 'Receive Task',
      'bpmn:ManualTask': 'Manual Task',
      'bpmn:BusinessRuleTask': 'Business Rule Task',
      'bpmn:CallActivity': 'Call Activity',
      'bpmn:SubProcess': 'Sub-Process',
      'bpmn:ExclusiveGateway': 'Exclusive Gateway',
      'bpmn:ParallelGateway': 'Parallel Gateway',
      'bpmn:InclusiveGateway': 'Inclusive Gateway',
      'bpmn:EventBasedGateway': 'Event-Based Gateway',
      'bpmn:IntermediateThrowEvent': 'Intermediate Throw Event',
      'bpmn:IntermediateCatchEvent': 'Intermediate Catch Event',
      'bpmn:BoundaryEvent': 'Boundary Event',
    };
    return map[bpmnType] ?? bpmnType.replace('bpmn:', '');
  }

  // --- Keyboard shortcuts ---

  private registerKeyboardShortcuts(): void {
    this.boundHandleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      switch (event.key) {
        case ' ':
          if (this.running) {
            event.preventDefault();
            this.togglePause();
          }
          break;
        case 'r':
        case 'R':
          if (this.running) {
            event.preventDefault();
            this.replaySimulation();
          }
          break;
        case 'Escape':
          if (this.running) {
            event.preventDefault();
            this.resetSimulation();
          }
          break;
      }
    };
    document.addEventListener('keydown', this.boundHandleKeyDown);
  }

  private unregisterKeyboardShortcuts(): void {
    if (this.boundHandleKeyDown) {
      document.removeEventListener('keydown', this.boundHandleKeyDown);
      this.boundHandleKeyDown = null;
    }
  }

  private getDefaultExclusiveFlow(element: any, outgoing: any[]): any {
    const defaultFlowRef = element.businessObject?.default;
    if (defaultFlowRef) {
      return outgoing.find((flow: any) => flow.businessObject?.id === defaultFlowRef.id) ?? outgoing[0];
    }
    return outgoing[0];
  }

  private getParallelMiIterations(element: any): number {
    const lc = element.businessObject?.loopCharacteristics;
    if (!lc || lc.$type !== 'bpmn:MultiInstanceLoopCharacteristics' || lc.isSequential) {
      return 0;
    }
    return this.multiInstanceConfig.get(element.id) ?? 3;
  }

  // --- Process discovery ---

  private forEachFlowElement(container: any, callback: (element: any) => void): void {
    const children: any[] = container.children || [];
    for (const child of children) {
      callback(child);
      if (child.type === 'bpmn:SubProcess' && child.children?.length > 0) {
        this.forEachFlowElement(child, callback);
      }
    }
  }

  private getProcessElements(rootElement: any): any[] {
    if (rootElement.type === 'bpmn:Process') {
      return [rootElement];
    }

    const children: any[] = rootElement.children || [];
    const participants = children.filter(
      (child: any) => child.type === 'bpmn:Participant' && child.businessObject?.processRef,
    );

    if (participants.length > 0) {
      return participants;
    }

    return [rootElement];
  }
}
