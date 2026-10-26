import { readManifest } from '#bifrost/common/plugin-host/manifest/ManifestReader';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function read(permissions: string[], contributes: Record<string, unknown>) {
  return readManifest({
    bifrostStudio: { apiVersion: '2.0.0', displayName: 'Landscape test plugin', permissions, contributes },
  });
}

const PALETTE = [{ id: 'mark', icon: 'ph-flag', title: 'Mark', command: 'mark' }];
const CONTEXT_PAD = [
  { id: 'inspect', icon: 'ph-eye', title: 'Inspect', command: 'inspect', elementTypes: ['process'] },
];
const MODULES = [{ entry: 'renderer/map-module.js', description: 'Draws a ring' }];

describe('ManifestReader landscape contributions', () => {
  it('accepts a manifest that holds every landscape contribution with its permissions', () => {
    const result = read(['landscape', 'landscape.renderer'], {
      landscapePalette: PALETTE,
      landscapeContextPad: CONTEXT_PAD,
      landscapeModules: MODULES,
    });

    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.warnings, []);
    assert.deepStrictEqual(result.manifest?.contributes?.landscapePalette, [
      { id: 'mark', group: undefined, icon: 'ph-flag', title: 'Mark', command: 'mark' },
    ]);
    assert.deepStrictEqual(result.manifest?.contributes?.landscapeContextPad?.[0].elementTypes, ['process']);
    assert.strictEqual(result.manifest?.contributes?.landscapeModules?.[0].entry, 'renderer/map-module.js');
  });

  it('lets landscape.modelling carry palette and context pad entries', () => {
    const result = read(['landscape.modelling'], { landscapePalette: PALETTE, landscapeContextPad: CONTEXT_PAD });

    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.warnings, []);
  });

  it('warns that palette and context pad entries need landscape.modelling', () => {
    const result = read(['landscape'], { landscapePalette: PALETTE, landscapeContextPad: CONTEXT_PAD });

    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(
      result.warnings.map((warning) => warning.path),
      ['bifrostStudio.contributes.landscapePalette', 'bifrostStudio.contributes.landscapeContextPad'],
    );
  });

  it('rejects renderer modules without landscape.renderer', () => {
    const result = read(['landscape.modelling'], { landscapeModules: MODULES });

    assert.deepStrictEqual(
      result.errors.map((error) => error.path),
      ['bifrostStudio.contributes.landscapeModules'],
    );
    assert.ok(result.errors[0].message.includes('landscape.renderer'));
  });

  it('does not take the DMN permission for landscape modules', () => {
    const result = read(['dmn.renderer'], { landscapeModules: MODULES });

    assert.ok(result.errors.some((error) => error.path === 'bifrostStudio.contributes.landscapeModules'));
  });

  it('names the landscape key in the errors of malformed entries', () => {
    const result = read(['landscape.renderer'], {
      landscapePalette: [{ id: 'mark' }],
      landscapeContextPad: 'inspect',
      landscapeModules: [{ description: 'no entry' }],
    });

    const paths = result.errors.map((error) => error.path);
    assert.ok(paths.includes('bifrostStudio.contributes.landscapePalette[0].icon'));
    assert.ok(paths.includes('bifrostStudio.contributes.landscapeContextPad'));
    assert.ok(paths.includes('bifrostStudio.contributes.landscapeModules[0].entry'));
    assert.ok(paths.every((path) => !path.includes('dmn')));
  });

  it('does not report landscape contributions as unknown keys', () => {
    const result = read(['landscape.renderer'], { landscapeModules: MODULES });

    assert.ok(result.warnings.every((warning) => !warning.message.toLowerCase().includes('unknown')));
  });
});
