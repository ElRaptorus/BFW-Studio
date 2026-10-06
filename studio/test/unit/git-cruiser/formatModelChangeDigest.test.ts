import { describe, expect, it } from 'vitest';

import type { ModelChangeDigest } from '../../../src/bifrost/contracts/SourceControlTypes';
import { formatModelChangeDigest } from '../../../src/modules/git-cruiser/formatModelChangeDigest';

const unchanged: ModelChangeDigest = {
  fileChange: 'modified',
  modelName: null,
  addedElementNames: [],
  removedElementNames: [],
  modifiedElementNames: [],
  layoutChangedCount: 0,
  fileDetailsChanged: false,
};

describe('formatModelChangeDigest', () => {
  it('names new and deleted models', () => {
    expect(formatModelChangeDigest({ ...unchanged, fileChange: 'added', addedElementNames: ['a'] })).toBe('New model');
    expect(formatModelChangeDigest({ ...unchanged, fileChange: 'deleted', modelName: 'x' })).toBe('Deleted model');
  });

  it('lists added, changed, removed, layout and file details in that order', () => {
    const digest: ModelChangeDigest = {
      ...unchanged,
      addedElementNames: ['a', 'b'],
      removedElementNames: ['c'],
      modifiedElementNames: ['d'],
      layoutChangedCount: 1,
      fileDetailsChanged: true,
    };

    expect(formatModelChangeDigest(digest)).toBe(
      '2 added · 1 changed · 1 removed · layout moved · file details changed',
    );
  });

  it('shows only the parts that occurred', () => {
    expect(formatModelChangeDigest({ ...unchanged, layoutChangedCount: 4 })).toBe('layout moved');
    expect(formatModelChangeDigest({ ...unchanged, removedElementNames: ['x'] })).toBe('1 removed');
    expect(formatModelChangeDigest({ ...unchanged, fileDetailsChanged: true })).toBe('file details changed');
  });

  it('says so when nothing changed', () => {
    expect(formatModelChangeDigest(unchanged)).toBe('No content changes');
  });
});
