import { describe, expect, it } from 'vitest';

import { getHumanizedDuration } from '../../../src/bifrost/common/DurationFunctions';

describe('getHumanizedDuration', () => {
  it('shows -- only for a missing value', () => {
    expect(getHumanizedDuration(null)).toBe('--');
    expect(getHumanizedDuration(undefined)).toBe('--');
    expect(getHumanizedDuration(Number.NaN)).toBe('--');
    expect(getHumanizedDuration(0)).toBe('0ms');
  });

  it('shows sub-millisecond values in whole microseconds', () => {
    expect(getHumanizedDuration(0.333)).toBe('333µs');
    expect(getHumanizedDuration(1.234)).toBe('1ms');
  });

  it('shows the largest units', () => {
    expect(getHumanizedDuration(999)).toBe('999ms');
    expect(getHumanizedDuration(61_000)).toBe('1m 1s');
    expect(getHumanizedDuration(90_061_000)).toBe('1d 1h 1m 1s');
  });
});
