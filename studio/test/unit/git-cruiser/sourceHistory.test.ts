import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { SourceHistory } from '../../../src/modules/git-cruiser/overview/components/SourceHistory';

function createEntry(date: string, overrides: Record<string, unknown> = {}) {
  return {
    hash: 'abc1234',
    parents: [],
    author: 'Ada',
    date,
    subject: 'Fix the order flow',
    refs: [],
    isUnpushed: false,
    mergedBranchName: null,
    ...overrides,
  } as any;
}

function render(entries: any[], hasMore = false, searchText = ''): string {
  const bifrost = { commands: { getClickHandler: () => () => () => undefined } } as any;
  // React separates adjacent text nodes with comments; the user never sees them
  return renderToStaticMarkup(
    React.createElement(SourceHistory, {
      bifrost,
      repositoryRoot: '/work/repository',
      entries,
      hasMore,
      searchText,
      getExpandedCommit: () => null,
      getDigest: () => null,
      onToggleCommit: () => undefined,
      onLoadMore: () => undefined,
    }),
  ).replaceAll('<!-- -->', '');
}

describe('SourceHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['2026-10-06T11:59:40Z', 'just now'],
    ['2026-10-06T11:48:00Z', '12 minutes ago'],
    ['2026-10-06T09:00:00Z', '3 hours ago'],
    ['2026-10-05T11:00:00Z', 'yesterday'],
    ['2026-09-22T12:00:00Z', '2 weeks ago'],
    ['2026-07-01T12:00:00Z', '3 months ago'],
    ['2024-10-01T12:00:00Z', '2 years ago'],
  ])('shows a commit from %s as "%s"', (date, expected) => {
    expect(render([createEntry(date)])).toContain(`Ada · ${expected}`);
  });

  it('leaves the age out for an unparsable date', () => {
    const markup = render([createEntry('not a date')]);
    expect(markup).toContain('Ada');
    expect(markup).not.toContain('Ada ·');
  });

  it('marks unpushed and merge commits and offers older commits', () => {
    const markup = render(
      [createEntry('2026-10-06T11:00:00Z', { isUnpushed: true, mergedBranchName: 'feature/x' })],
      true,
    );
    expect(markup).toContain('Not pushed');
    expect(markup).toContain('Merged feature/x');
    expect(markup).toContain('data-test--history-load-more');
  });

  it('says so when there are no commits', () => {
    expect(render([])).toContain('There are no commits on this branch yet.');
  });

  it('says that nothing matches a search, instead of claiming an empty branch', () => {
    const markup = render([], false, 'zeta');
    expect(markup).toContain('No commits match &quot;zeta&quot;.');
    expect(markup).not.toContain('There are no commits on this branch yet.');
  });
});
