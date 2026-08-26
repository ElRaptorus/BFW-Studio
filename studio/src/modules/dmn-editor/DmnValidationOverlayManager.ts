import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';

import type DmnModelerComponentAdapter from '../dmn-core/DmnModelerComponentAdapter';
import { DmnValidator, type DmnViolation } from '../dmn-core/validation/DmnValidator';

export const EVENT_DMN_VALIDATION_UPDATED = 'EVENT_DMN_VALIDATION_UPDATED';

const VALIDATION_DEBOUNCE_MS = 500;
const OVERLAY_TYPE = 'dmn-validation';

export default class DmnValidationOverlayManager extends AbstractEmitter {
  private adapter: DmnModelerComponentAdapter;
  private validator: DmnValidator;
  private violations: DmnViolation[] = [];
  private overlayIds: string[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private enabled: boolean = true;

  constructor(adapter: DmnModelerComponentAdapter) {
    super();
    this.adapter = adapter;
    this.validator = new DmnValidator();
  }

  getViolations(): DmnViolation[] {
    return this.violations;
  }

  getViolationsByElementId(elementId: string): DmnViolation[] {
    return this.violations.filter((violation) => violation.elementId === elementId);
  }

  getErrorCount(): number {
    return this.violations.filter((violation) => violation.severity === 'error').length;
  }

  getWarningCount(): number {
    return this.violations.filter((violation) => violation.severity === 'warning').length;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearOverlays();
      this.violations = [];
      this.emit(EVENT_DMN_VALIDATION_UPDATED, [this.violations]);
    }
  }

  requestValidation(): void {
    if (!this.enabled) {
      return;
    }

    if (this.debounceTimer != null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.runValidation();
    }, VALIDATION_DEBOUNCE_MS);
  }

  dispose(): void {
    if (this.debounceTimer != null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.clearOverlays();
    this.violations = [];
  }

  private runValidation(): void {
    try {
      const modeler = this.adapter.getModeler();
      const definitions = modeler?._definitions;
      if (!definitions) {
        return;
      }

      this.violations = this.validator.validate(definitions);
      this.updateOverlays();
      this.emit(EVENT_DMN_VALIDATION_UPDATED, [this.violations]);
    } catch {
      this.violations = [];
      this.emit(EVENT_DMN_VALIDATION_UPDATED, [this.violations]);
    }
  }

  private updateOverlays(): void {
    this.clearOverlays();

    if (!this.adapter.isDrdActive()) {
      return;
    }

    let overlays: any;
    try {
      overlays = this.adapter.getDrdOverlays();
    } catch {
      return;
    }

    const violationsByElement = new Map<string, DmnViolation[]>();
    for (const violation of this.violations) {
      if (!violation.elementId) {
        continue;
      }
      const existing = violationsByElement.get(violation.elementId) ?? [];
      existing.push(violation);
      violationsByElement.set(violation.elementId, existing);
    }

    let elementRegistry: any;
    try {
      elementRegistry = this.adapter.getDrdElementRegistry();
    } catch {
      return;
    }

    for (const [elementId, elementViolations] of violationsByElement) {
      const element = elementRegistry.get(elementId);
      if (!element) {
        continue;
      }

      const hasError = elementViolations.some((violation) => violation.severity === 'error');
      const iconClass = hasError ? 'dmn-validation-overlay--error' : 'dmn-validation-overlay--warning';
      const count = elementViolations.length;
      const severityLabel = hasError ? 'error' : 'warning';

      const container = document.createElement('div');
      container.className = `dmn-validation-overlay ${iconClass}`;
      container.title = `${count} ${severityLabel}${count > 1 ? 's' : ''}`;
      container.textContent = String(count);

      try {
        const overlayId = overlays.add(elementId, OVERLAY_TYPE, {
          position: { top: -12, right: -12 },
          html: container,
        });
        this.overlayIds.push(overlayId);
      } catch {
        // Element may not be visible or overlay limit reached
      }
    }
  }

  private clearOverlays(): void {
    if (this.overlayIds.length === 0) {
      return;
    }

    let overlays: any;
    try {
      overlays = this.adapter.getDrdOverlays();
    } catch {
      this.overlayIds = [];
      return;
    }

    for (const overlayId of this.overlayIds) {
      try {
        overlays.remove(overlayId);
      } catch {
        // Already removed
      }
    }
    this.overlayIds = [];
  }
}
