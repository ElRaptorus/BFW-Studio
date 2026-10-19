import { calculateSelectorSpecificity } from '#bifrost/browser/SelectorSpecificityFunctions';
import assert from 'node:assert';
import { describe, it } from 'vitest';

describe('SelectorSpecificityFunctions', () => {
  const cases: [string, number][] = [
    ['body', 1],
    ['.a', 10],
    ['#a', 100],
    ['.a .b', 20],
    ['atom-workspace .editor:not(.mini)', 21],
    ['a::before', 2],
    ['[data-x] .y', 20],
    ['.a, #b', 10],
    ['div > p + .x ~ #y', 112],
    ['*', 0],
  ];

  for (const [selector, expected] of cases) {
    it(`calculateSelectorSpecificity('${selector}') is ${expected}`, () => {
      assert.strictEqual(calculateSelectorSpecificity(selector), expected);
    });
  }
});
