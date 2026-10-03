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

describe('ManifestReader contributes.pages', () => {
  const valid = { id: 'discover/insights', label: 'Insights', icon: 'ph-chart-line' };

  it('accepts a page and keeps its optional fields', () => {
    const page = {
      ...valid,
      order: 5,
      editorTabsVisible: false,
      paneAreas: ['left', 'bottom'],
      defaultDocumentUri: 'x://y',
    };
    const result = read({ pages: [page] });
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.manifest?.contributes?.pages?.[0].id, 'discover/insights');
    assert.deepStrictEqual(result.manifest?.contributes?.pages?.[0].paneAreas, ['left', 'bottom']);
  });

  it.each([
    ['id', { ...valid, id: 'Discover' }],
    ['id', { ...valid, id: 'noslash' }],
    ['label', { ...valid, label: ' ' }],
    ['icon', { ...valid, icon: undefined }],
    ['order', { ...valid, order: 'first' }],
    ['editorTabsVisible', { ...valid, editorTabsVisible: 'no' }],
    ['defaultDocumentUri', { ...valid, defaultDocumentUri: 3 }],
    ['paneAreas', { ...valid, paneAreas: ['top'] }],
  ])('rejects an invalid %s', (field, page) => {
    const result = read({ pages: [page] });
    assert.ok(result.errors.some((error) => error.path === `bifrostStudio.contributes.pages[0].${field}`));
  });

  it('warns about and ignores unknown page fields', () => {
    const result = read({ pages: [{ ...valid, categoryId: 'discover' }] });
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.warnings.some((warning) => warning.path === 'bifrostStudio.contributes.pages[0].categoryId'));
    assert.strictEqual(result.manifest?.contributes?.pages?.length, 1);
  });

  it('rejects non-arrays, non-objects and duplicate ids within one plugin', () => {
    assert.ok(read({ pages: 'x' }).errors.some((error) => error.path.endsWith('.pages')));
    assert.ok(read({ pages: [3] }).errors.some((error) => error.path.endsWith('pages[0]')));
    assert.ok(read({ pages: [valid, valid] }).errors.some((error) => error.message.includes('Duplicate')));
  });
});
