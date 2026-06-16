import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import type { Diagnostic, DiagnosticCounts, DiagnosticsManager } from '../common/DiagnosticsManager';
import { EVENT_DIAGNOSTICS_CHANGED } from '../common/DiagnosticsManager';

export class DiagnosticsMediator extends AbstractEmitter {
  private diagnosticsManager: DiagnosticsManager;

  constructor(diagnosticsManager: DiagnosticsManager) {
    super();
    this.diagnosticsManager = diagnosticsManager;

    this.diagnosticsManager.on(EVENT_DIAGNOSTICS_CHANGED, () => this.emit(EVENT_DIAGNOSTICS_CHANGED));
  }

  setDiagnostics(uri: string, owner: string, diagnostics: Diagnostic[]): void {
    this.diagnosticsManager.setDiagnostics(uri, owner, diagnostics);
  }

  clearDiagnostics(owner: string): void {
    this.diagnosticsManager.clearDiagnostics(owner);
  }

  getDiagnostics(uri?: string): Map<string, Diagnostic[]> {
    return this.diagnosticsManager.getDiagnostics(uri);
  }

  getCount(): DiagnosticCounts {
    return this.diagnosticsManager.getCount();
  }
}
