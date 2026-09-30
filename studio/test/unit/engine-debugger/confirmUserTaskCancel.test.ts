import type { DialogResult } from '#bifrost/contracts/DialogTypes';
import { confirmUserTaskCancel } from '#modules/engine-debugger/task-viewer/confirmUserTaskCancel';
import assert from 'node:assert';
import { describe, it } from 'vitest';

describe('confirm user task cancel', () => {
  it('returns true only for the cancel-user-task response', async () => {
    const confirmed = await confirmUserTaskCancel(async () => ({
      wasCancelled: false,
      response: 'cancel-user-task',
    }));
    const kept = await confirmUserTaskCancel(async () => ({ wasCancelled: false, response: 'keep' }));
    const closed = await confirmUserTaskCancel(async () => ({ wasCancelled: true }) satisfies DialogResult);

    assert.equal(confirmed, true);
    assert.equal(kept, false);
    assert.equal(closed, false);
  });
});
