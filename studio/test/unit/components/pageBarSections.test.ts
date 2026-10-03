import type { MenuBarItem } from '#bifrost/contracts/MenuBarTypes';
import { buildPageBarSections } from '#components/header/pageBarSections';
import { describe, expect, it } from 'vitest';

const item: MenuBarItem = { type: 'button', id: 'item' } as MenuBarItem;

function build(pageCount: number, centerCount = 0, endCount = 0, toggleCount = 0) {
  const items = (count: number) => Array.from({ length: count }, () => item);
  return buildPageBarSections({
    pageCount,
    centerItems: items(centerCount),
    endItems: items(endCount),
    layoutToggleItems: items(toggleCount),
  });
}

describe('buildPageBarSections', () => {
  it('stays hidden with a single page and nothing to show', () => {
    expect(build(1).visible).toBe(false);
  });

  it.each([
    ['several pages', build(2)],
    ['a center item', build(1, 1)],
    ['an end item', build(1, 0, 1)],
    ['layout toggles alone', build(1, 0, 0, 1)],
  ])('is visible with %s', (_label, sections) => {
    expect(sections.visible).toBe(true);
  });

  it('shows the divider only between end items and layout toggles', () => {
    expect(build(1, 0, 1, 1).showDivider).toBe(true);
    expect(build(1, 0, 1, 0).showDivider).toBe(false);
    expect(build(1, 0, 0, 1).showDivider).toBe(false);
  });
});
