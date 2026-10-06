import { describe, expect, it } from 'vitest';

import { formatCommitAge } from '../../../src/modules/git-cruiser/formatCommitAge';

describe('formatCommitAge', () => {
  const now = new Date('2026-10-06T12:00:00Z');

  it.each([
    ['2026-10-06T11:59:40Z', 'just now'],
    ['2026-10-06T12:05:00Z', 'just now'],
    ['2026-10-06T11:48:00Z', '12 minutes ago'],
    ['2026-10-06T11:59:00Z', '1 minute ago'],
    ['2026-10-06T09:00:00Z', '3 hours ago'],
    ['2026-10-05T11:00:00Z', 'yesterday'],
    ['2026-10-02T12:00:00Z', '4 days ago'],
    ['2026-09-22T12:00:00Z', '2 weeks ago'],
    ['2026-07-01T12:00:00Z', '3 months ago'],
    ['2025-10-10T12:00:00Z', '11 months ago'],
    ['2025-10-06T12:00:00Z', 'last year'],
    ['2024-10-01T12:00:00Z', '2 years ago'],
  ])('formats %s as %s', (isoDate, expected) => {
    expect(formatCommitAge(isoDate, now)).toBe(expected);
  });

  it('returns an empty string for an unparsable date', () => {
    expect(formatCommitAge('not a date', now)).toBe('');
  });
});
