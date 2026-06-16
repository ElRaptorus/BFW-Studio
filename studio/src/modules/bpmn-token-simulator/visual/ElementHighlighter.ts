const ACTIVE_CLASS = 'token-sim-highlight-active';
const COMPLETED_CLASS = 'token-sim-highlight-completed';
const ERROR_CLASS = 'token-sim-highlight-error';
const FLOW_CHOSEN_CLASS = 'token-sim-highlight-flow-chosen';
const VISITED_CLASS = 'token-sim-highlight-visited';
const FLOW_VISITED_CLASS = 'token-sim-highlight-flow-visited';
const MESSAGE_FLOW_CLASS = 'token-sim-highlight-message-flow';
const MESSAGE_PULSE_CLASS = 'token-sim-highlight-message-pulse';

export class ElementHighlighter {
  private elementRegistry: any;
  private activeElements = new Set<string>();
  private completedElements = new Set<string>();
  private errorElements = new Set<string>();
  private highlightedFlows = new Set<string>();
  private preferredFlows = new Set<string>();
  private visitedElements = new Set<string>();
  private visitedFlows = new Set<string>();
  private messageFlows = new Set<string>();

  constructor(elementRegistry: any) {
    this.elementRegistry = elementRegistry;
  }

  markActive(element: any): void {
    const gfx = this.getGraphics(element);
    if (!gfx) {
      return;
    }

    gfx.classList.add(ACTIVE_CLASS);
    gfx.classList.remove(COMPLETED_CLASS);
    this.activeElements.add(element.id);
    this.completedElements.delete(element.id);
  }

  markCompleted(element: any): void {
    const gfx = this.getGraphics(element);
    if (!gfx) {
      return;
    }

    gfx.classList.remove(ACTIVE_CLASS);
    gfx.classList.add(COMPLETED_CLASS);
    this.activeElements.delete(element.id);
    this.completedElements.add(element.id);
  }

  markError(element: any): void {
    const gfx = this.getGraphics(element);
    if (!gfx) {
      return;
    }

    gfx.classList.remove(ACTIVE_CLASS, COMPLETED_CLASS);
    gfx.classList.add(ERROR_CLASS);
    this.activeElements.delete(element.id);
    this.completedElements.delete(element.id);
    this.errorElements.add(element.id);
  }

  markVisited(element: any): void {
    const gfx = this.getGraphics(element);
    if (!gfx) {
      return;
    }

    gfx.classList.add(VISITED_CLASS);
    this.visitedElements.add(element.id);
  }

  markFlowVisited(connection: any): void {
    const gfx = this.getGraphics(connection);
    if (!gfx) {
      return;
    }

    gfx.classList.add(FLOW_VISITED_CLASS);
    this.visitedFlows.add(connection.id);
  }

  clearElement(element: any): void {
    const gfx = this.getGraphics(element);
    if (gfx) {
      gfx.classList.remove(ACTIVE_CLASS, COMPLETED_CLASS, ERROR_CLASS, VISITED_CLASS);
    }
    this.activeElements.delete(element.id);
    this.completedElements.delete(element.id);
    this.errorElements.delete(element.id);
    this.visitedElements.delete(element.id);
  }

  markFlow(connection: any): void {
    const gfx = this.getGraphics(connection);
    if (!gfx) {
      return;
    }

    gfx.classList.add(FLOW_CHOSEN_CLASS);
    this.highlightedFlows.add(connection.id);
  }

  markPreferredFlow(connection: any): void {
    const gfx = this.getGraphics(connection);
    if (!gfx) {
      return;
    }

    gfx.classList.add(FLOW_CHOSEN_CLASS);
    this.preferredFlows.add(connection.id);
  }

  clearPreferredFlow(connection: any): void {
    const gfx = this.getGraphics(connection);
    if (gfx) {
      gfx.classList.remove(FLOW_CHOSEN_CLASS);
    }
    this.preferredFlows.delete(connection.id);
  }

  clearAllPreferredFlows(): void {
    for (const flowId of this.preferredFlows) {
      try {
        const element = this.elementRegistry.get(flowId);
        if (element) {
          const gfx = this.elementRegistry.getGraphics(element);
          gfx?.classList.remove(FLOW_CHOSEN_CLASS);
        }
      } catch {
        /* flow may have been removed */
      }
    }
    this.preferredFlows.clear();
  }

  markMessageFlow(connection: any): void {
    const gfx = this.getGraphics(connection);
    if (!gfx) {
      return;
    }

    gfx.classList.add(MESSAGE_FLOW_CLASS);
    this.messageFlows.add(connection.id);
  }

  clearMessageFlow(connection: any): void {
    const gfx = this.getGraphics(connection);
    if (gfx) {
      gfx.classList.remove(MESSAGE_FLOW_CLASS);
    }
    this.messageFlows.delete(connection.id);
  }

  clearAllMessageFlows(): void {
    for (const flowId of this.messageFlows) {
      try {
        const element = this.elementRegistry.get(flowId);
        if (element) {
          const gfx = this.elementRegistry.getGraphics(element);
          gfx?.classList.remove(MESSAGE_FLOW_CLASS);
        }
      } catch {
        /* flow may have been removed */
      }
    }
    this.messageFlows.clear();
  }

  pulseElement(element: any): void {
    const gfx = this.getGraphics(element);
    if (!gfx) {
      return;
    }

    gfx.classList.remove(MESSAGE_PULSE_CLASS);
    void gfx.getBoundingClientRect();
    gfx.classList.add(MESSAGE_PULSE_CLASS);

    setTimeout(() => {
      gfx.classList.remove(MESSAGE_PULSE_CLASS);
    }, 1200);
  }

  clearFlows(): void {
    for (const flowId of this.highlightedFlows) {
      if (this.preferredFlows.has(flowId)) {
        continue;
      }
      try {
        const element = this.elementRegistry.get(flowId);
        if (element) {
          const gfx = this.elementRegistry.getGraphics(element);
          gfx?.classList.remove(FLOW_CHOSEN_CLASS);
        }
      } catch {
        // flow may have been removed
      }
    }
    this.highlightedFlows.clear();
  }

  clear(): void {
    for (const elementId of [...this.activeElements, ...this.completedElements, ...this.errorElements]) {
      try {
        const element = this.elementRegistry.get(elementId);
        if (element) {
          const gfx = this.elementRegistry.getGraphics(element);
          gfx?.classList.remove(ACTIVE_CLASS, COMPLETED_CLASS, ERROR_CLASS);
        }
      } catch {
        // Element may have been removed from the registry
      }
    }
    this.activeElements.clear();
    this.completedElements.clear();
    this.errorElements.clear();

    for (const elementId of this.visitedElements) {
      try {
        const element = this.elementRegistry.get(elementId);
        if (element) {
          const gfx = this.elementRegistry.getGraphics(element);
          gfx?.classList.remove(VISITED_CLASS);
        }
      } catch {
        /* element may have been removed */
      }
    }
    this.visitedElements.clear();

    for (const flowId of this.visitedFlows) {
      try {
        const element = this.elementRegistry.get(flowId);
        if (element) {
          const gfx = this.elementRegistry.getGraphics(element);
          gfx?.classList.remove(FLOW_VISITED_CLASS);
        }
      } catch {
        /* flow may have been removed */
      }
    }
    this.visitedFlows.clear();

    this.clearFlows();
    this.clearAllPreferredFlows();
    this.clearAllMessageFlows();
  }

  private getGraphics(element: any): SVGElement | null {
    try {
      return this.elementRegistry.getGraphics(element);
    } catch {
      return null;
    }
  }
}
