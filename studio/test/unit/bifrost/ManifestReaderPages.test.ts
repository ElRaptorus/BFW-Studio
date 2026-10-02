import { readManifest } from '#bifrost/common/plugin-host/manifest/ManifestReader';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function read(contributes: Record<string, unknown>) {
  return readManifest({ bifrostStudio: { apiVersion: '2.0.0', contributes } });
}

describe('ManifestReader pages (Plugin API 2.0.0)', () => {
  it('requires pages on left panes', () => {
    const result = read({ panes: [{ id: 'a', title: 'A', area: 'left' }] });
    assert.ok(result.errors.some((error) => error.path.endsWith('panes[0].pages')));
  });

  it('accepts pages on left panes and defaults right panes to every page', () => {
    const result = read({
      panes: [
        { id: 'a', title: 'A', area: 'left', pages: ['design/workspace'] },
        { id: 'b', title: 'B', area: 'right' },
      ],
    });
    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.manifest?.contributes?.panes?.[0].pages, ['design/workspace']);
  });

  it('rejects malformed page ids', () => {
    const result = read({ panes: [{ id: 'a', title: 'A', area: 'right', pages: ['Design'] }] });
    assert.ok(result.errors.some((error) => error.path.endsWith('panes[0].pages')));
  });

  it('requires page on editor document types', () => {
    const base = { id: 'e', displayName: 'E', icon: 'x', uriPattern: '\\.e$' };
    assert.ok(read({ editorDocumentTypes: [base] }).errors.some((error) => error.path.endsWith('.page')));
    assert.deepStrictEqual(read({ editorDocumentTypes: [{ ...base, page: 'active' }] }).errors, []);
    assert.deepStrictEqual(read({ editorDocumentTypes: [{ ...base, page: 'design/workspace' }] }).errors, []);
  });

  it('rejects paneToggles', () => {
    const result = read({ paneToggles: [] });
    assert.ok(result.errors.some((error) => error.message.includes('removed in Plugin API 2.0.0')));
  });
});
