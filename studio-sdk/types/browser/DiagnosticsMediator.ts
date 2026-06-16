export declare type DiagnosticSeverity = 'error' | 'warning' | 'info';

export declare type Diagnostic = {
  severity: DiagnosticSeverity;
  message: string;
  source: string;
};

export declare type DiagnosticCounts = {
  errors: number;
  warnings: number;
  infos: number;
};

export declare class DiagnosticsMediator {
  setDiagnostics(uri: string, owner: string, diagnostics: Diagnostic[]): void;
  clearDiagnostics(owner: string): void;
  getDiagnostics(uri?: string): Map<string, Diagnostic[]>;
  getCount(): DiagnosticCounts;
}
