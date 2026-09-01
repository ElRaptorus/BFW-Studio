import assert from 'node:assert';
import { describe, it } from 'vitest';

import { waitForDrdCanvasLayout } from '../../../src/modules/dmn-core/waitForDrdCanvasLayout';

describe('waitForDrdCanvasLayout', () => {
  it('returns true immediately when DRD is not the active view', async () => {
    let resized = 0;
    const ready = await waitForDrdCanvasLayout(
      () => false,
      () => {
        resized += 1;
      },
      () => ({ width: 0, height: 0 }),
    );
    assert.strictEqual(ready, true);
    assert.strictEqual(resized, 0);
  });

  it('retries resized() until the outer viewbox is non-zero', async () => {
    let width = 0;
    let resized = 0;
    const ready = waitForDrdCanvasLayout(
      () => true,
      () => {
        resized += 1;
      },
      () => ({ width, height: 100 }),
      500,
    );
    setTimeout(() => {
      width = 400;
    }, 40);
    assert.strictEqual(await ready, true);
    assert.ok(resized >= 1);
  });

  it('returns false when the canvas stays 0×0 past the timeout', async () => {
    const ready = await waitForDrdCanvasLayout(
      () => true,
      () => undefined,
      () => ({ width: 0, height: 0 }),
      50,
    );
    assert.strictEqual(ready, false);
  });
});
