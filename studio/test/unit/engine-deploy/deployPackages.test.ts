import {
  findPackage,
  readPackages,
  removePackage,
  toPackageFileUri,
  toRelativePackagePath,
  upsertPackage,
  validatePackageName,
} from '#modules/engine-deploy/analysis/deployPackages';
import { describe, expect, it } from 'vitest';

describe('deploy packages', () => {
  it('round-trips file paths relative to the solution folder', () => {
    const relative = toRelativePackagePath('file:///work/shop/a/order.bpmn', 'file:///work/shop');
    expect(relative).toBe('a/order.bpmn');
    expect(toPackageFileUri(relative, 'file:///work/shop')).toBe('file:///work/shop/a/order.bpmn');
    expect(toRelativePackagePath('file:///work/other/x.dmn', 'file:///work/shop')).toBe('../other/x.dmn');
  });

  it('rejects blank names and finds packages ignoring case', () => {
    expect(validatePackageName('  ')).not.toBeNull();
    expect(validatePackageName('Release')).toBeNull();
    expect(findPackage([{ name: 'Release', files: [] }], ' release ')?.name).toBe('Release');
  });

  it('replaces a package of the same name in place and de-duplicates files', () => {
    const packages = upsertPackage(
      [
        { name: 'A', files: ['x'] },
        { name: 'B', files: [] },
      ],
      'a',
      ['y', 'y'],
    );
    expect(packages).toEqual([
      { name: 'a', files: ['y'] },
      { name: 'B', files: [] },
    ]);
    expect(removePackage(packages, 'B')).toEqual([{ name: 'a', files: ['y'] }]);
  });

  it('drops malformed setting entries', () => {
    expect(readPackages('nope')).toEqual([]);
    expect(readPackages([null, { name: '', files: [] }, { name: 'ok', files: ['a', 1] }, { name: 'bad' }])).toEqual([
      { name: 'ok', files: ['a'] },
    ]);
  });
});
