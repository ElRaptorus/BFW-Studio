import type { Diagnostic } from '@codemirror/lint';

export const UNKNOWN_SETTING_LINT_MESSAGE = 'Unknown setting.';

/**
 * `codemirror-json-schema` uses json-schema-library, which ignores VS Code
 * `errorMessage` and renders `additionalProperties: { not: true }` as
 * "Value `false` at pointer should not match schema `true`".
 * `additionalProperties: false` becomes "Additional property `…` is not allowed".
 * Both mean an unregistered settings key (plugin leftover). Runtime
 * `validateSettings` still accepts those keys; the editor must warn, not error.
 */
export function isUnknownSettingDiagnostic(diagnostic: Diagnostic): boolean {
  const message = diagnostic.message;
  return message.includes('should not match schema') || message.includes('Additional property ');
}

export function rewriteUnknownSettingDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.map((diagnostic) => {
    if (!isUnknownSettingDiagnostic(diagnostic)) {
      return diagnostic;
    }
    return {
      from: diagnostic.from,
      to: diagnostic.to,
      message: UNKNOWN_SETTING_LINT_MESSAGE,
      severity: 'warning',
      source: diagnostic.source,
    };
  });
}
