import {
  UNKNOWN_SETTING_LINT_MESSAGE,
  isUnknownSettingDiagnostic,
  rewriteUnknownSettingDiagnostics,
} from '#components/code-editor/unknownSettingDiagnostics';
import type { Diagnostic } from '@codemirror/lint';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function diagnostic(message: string, severity: Diagnostic['severity'] = 'error'): Diagnostic {
  return { from: 0, to: 10, message, severity, source: 'json-schema' };
}

describe('rewriteUnknownSettingDiagnostics', () => {
  it('rewrites the json-schema-library NotError copy to a warning', () => {
    const rewritten = rewriteUnknownSettingDiagnostics([
      diagnostic('Value `false` at pointer should not match schema `true`'),
    ]);

    assert.strictEqual(rewritten[0].message, UNKNOWN_SETTING_LINT_MESSAGE);
    assert.strictEqual(rewritten[0].severity, 'warning');
    assert.strictEqual(rewritten[0].from, 0);
    assert.strictEqual(rewritten[0].to, 10);
  });

  it('rewrites additionalProperties: false copy to a warning', () => {
    const rewritten = rewriteUnknownSettingDiagnostics([
      diagnostic('Additional property `webviewShowcase.panes.showExample` is not allowed'),
    ]);

    assert.strictEqual(rewritten[0].message, UNKNOWN_SETTING_LINT_MESSAGE);
    assert.strictEqual(rewritten[0].severity, 'warning');
  });

  it('leaves type errors unchanged', () => {
    const original = diagnostic('Expected `boolean` but received `string`');
    const rewritten = rewriteUnknownSettingDiagnostics([original]);

    assert.strictEqual(rewritten[0].message, original.message);
    assert.strictEqual(rewritten[0].severity, 'error');
  });

  it('recognizes unknown-setting messages', () => {
    assert.strictEqual(
      isUnknownSettingDiagnostic(diagnostic('Value `false` at pointer should not match schema `true`')),
      true,
    );
    assert.strictEqual(isUnknownSettingDiagnostic(diagnostic('Expected `string` but received `number`')), false);
  });
});
