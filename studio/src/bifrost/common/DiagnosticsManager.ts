import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';

export const EVENT_DIAGNOSTICS_CHANGED = 'EVENT_DIAGNOSTICS_CHANGED';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export type Diagnostic = {
  severity: DiagnosticSeverity;
  message: string;
  source: string;
};

export type DiagnosticCounts = {
  errors: number;
  warnings: number;
  infos: number;
};

export class DiagnosticsManager extends AbstractEmitter {
  private store: Map<string, Map<string, Diagnostic[]>> = new Map();

  setDiagnostics(uri: string, owner: string, diagnostics: Diagnostic[]): void {
    let uriMap = this.store.get(uri);
    if (!uriMap) {
      uriMap = new Map();
      this.store.set(uri, uriMap);
    }

    if (diagnostics.length === 0) {
      uriMap.delete(owner);
      if (uriMap.size === 0) {
        this.store.delete(uri);
      }
    } else {
      uriMap.set(owner, diagnostics);
    }

    this.emit(EVENT_DIAGNOSTICS_CHANGED);
  }

  clearDiagnostics(owner: string): void {
    for (const [uri, uriMap] of this.store) {
      uriMap.delete(owner);
      if (uriMap.size === 0) {
        this.store.delete(uri);
      }
    }
    this.emit(EVENT_DIAGNOSTICS_CHANGED);
  }

  getDiagnostics(uri?: string): Map<string, Diagnostic[]> {
    const result = new Map<string, Diagnostic[]>();

    if (uri != null) {
      const uriMap = this.store.get(uri);
      if (uriMap) {
        const merged: Diagnostic[] = [];
        for (const diagnostics of uriMap.values()) {
          merged.push(...diagnostics);
        }
        result.set(uri, merged);
      }
      return result;
    }

    for (const [storeUri, uriMap] of this.store) {
      const merged: Diagnostic[] = [];
      for (const diagnostics of uriMap.values()) {
        merged.push(...diagnostics);
      }
      result.set(storeUri, merged);
    }
    return result;
  }

  getCount(): DiagnosticCounts {
    let errors = 0;
    let warnings = 0;
    let infos = 0;

    for (const uriMap of this.store.values()) {
      for (const diagnostics of uriMap.values()) {
        for (const diagnostic of diagnostics) {
          switch (diagnostic.severity) {
            case 'error':
              errors++;
              break;
            case 'warning':
              warnings++;
              break;
            case 'info':
              infos++;
              break;
          }
        }
      }
    }

    return { errors, warnings, infos };
  }
}
