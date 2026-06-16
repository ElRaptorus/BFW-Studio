export interface PluginManifest {
  apiVersion: string;
  displayName?: string;
  description?: string;
  icon?: string;
  activationEvents?: string[];
  contributes?: Record<string, unknown>;
  permissions?: string[];
}

export interface PluginManifestDiagnostic {
  path: string;
  message: string;
}

export interface PluginInfo {
  name: string;
  /** Original npm scoped name (e.g. `@scope/name`), present only when it differs from `name`. */
  packageName?: string;
  path: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  status: 'loaded' | 'pending' | 'disabled' | 'error' | 'quarantined';
  errorMessage?: string;
  readmePath?: string;
  logoPath?: string;
  homepage?: string;
  keywords?: string[];
  deprecated?: string | boolean;
  manifest?: PluginManifest;
  manifestErrors?: PluginManifestDiagnostic[];
  manifestWarnings?: PluginManifestDiagnostic[];
}
