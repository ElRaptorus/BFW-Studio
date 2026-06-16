import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import type { LintFinding, LintSeverity } from './types';

const MARKER_CLASSES: Record<LintSeverity, string> = {
  error: 'lint-error',
  warning: 'lint-warning',
  info: 'lint-info',
};

const ALL_MARKER_CLASSES = Object.values(MARKER_CLASSES);

/**
 * Manages canvas markers for lint findings.
 * Each element gets the marker for its worst severity.
 *
 * Process-level findings (where elementId is a bpmn:Process id) are
 * resolved to the enclosing bpmn:Participant pool shape so the pool
 * outline receives the severity coloring.
 */
export class LintOverlayManager {
  private canvas: Canvas;
  private elementRegistry: ElementRegistry;
  private markedElements: Set<string> = new Set();
  private processToParticipant: Map<string, string> | null = null;

  constructor(canvas: Canvas, elementRegistry: ElementRegistry) {
    this.canvas = canvas;
    this.elementRegistry = elementRegistry;
  }

  update(findings: LintFinding[]): void {
    this.clear();
    this.processToParticipant = null;

    const worstSeverityByElement = new Map<string, LintSeverity>();
    for (const finding of findings) {
      if (!finding.elementId) {
        continue;
      }

      const current = worstSeverityByElement.get(finding.elementId);
      if (!current || severityRank(finding.severity) < severityRank(current)) {
        worstSeverityByElement.set(finding.elementId, finding.severity);
      }
    }

    for (const [elementId, severity] of worstSeverityByElement) {
      const resolvedId = this.resolveToCanvasShape(elementId);
      const markerClass = MARKER_CLASSES[severity];
      try {
        this.canvas.addMarker(resolvedId, markerClass);
        this.markedElements.add(resolvedId);
      } catch {
        // Element may not exist on canvas
      }
    }
  }

  clear(): void {
    for (const elementId of this.markedElements) {
      for (const cls of ALL_MARKER_CLASSES) {
        try {
          this.canvas.removeMarker(elementId, cls);
        } catch {
          // Ignore — element may have been removed
        }
      }
    }
    this.markedElements.clear();
  }

  /**
   * If the elementId is already a canvas shape, return it as-is.
   * Otherwise check if it's a bpmn:Process id and resolve it to
   * the corresponding bpmn:Participant (pool) shape id.
   */
  private resolveToCanvasShape(elementId: string): string {
    if (this.elementRegistry.get(elementId)) {
      return elementId;
    }

    const participantId = this.getProcessToParticipantMap().get(elementId);
    return participantId ?? elementId;
  }

  private getProcessToParticipantMap(): Map<string, string> {
    if (this.processToParticipant) {
      return this.processToParticipant;
    }

    this.processToParticipant = new Map();
    const participants = this.elementRegistry.filter((element) => element.type === 'bpmn:Participant');

    for (const participant of participants) {
      const processRefId = participant.businessObject?.processRef?.id as string | undefined;
      if (processRefId) {
        this.processToParticipant.set(processRefId, participant.id);
      }
    }

    return this.processToParticipant;
  }
}

function severityRank(severity: LintSeverity): number {
  switch (severity) {
    case 'error':
      return 0;
    case 'warning':
      return 1;
    case 'info':
      return 2;
  }
}
