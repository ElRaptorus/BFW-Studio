import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'vitest';

import { OsSpecificKeystroke } from '../../OsSpecificKeystroke';
import type { StudioAgent } from '../../StudioAgent';
import { createAndStartStudioAgent } from '../../StudioAgent';

const SELECT_ALL = OsSpecificKeystroke('cmd-a', 'ctrl-a');

describe('machine-sanctum', () => {
  let studioAgent: StudioAgent;

  beforeEach(async ({ task }) => {
    studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    await studioAgent.maximize();
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
  });

  it('machine-sanctum: should navigate all pages without errors', async () => {
    await studioAgent.openUriAsDocument('about:machine-sanctum/home');
    await studioAgent.openUriAsDocument('about:machine-sanctum/notifications');
    await studioAgent.openUriAsDocument('about:machine-sanctum/dialogs');
    await studioAgent.openUriAsDocument('about:machine-sanctum/treeview');
    await studioAgent.openUriAsDocument('about:machine-sanctum/quickjump');
    await studioAgent.openUriAsDocument('about:machine-sanctum/contextmenu');
    await studioAgent.openUriAsDocument('about:machine-sanctum/errors');
    await studioAgent.openUriAsDocument('about:machine-sanctum/feel_editor');
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('machine-sanctum/feel_editor: should evaluate FEEL expressions', async () => {
    await studioAgent.openUriAsDocument('about:machine-sanctum/feel_editor');

    await studioAgent.assertVisible('[data-test--feel-result="idle"]');

    await studioAgent.clickOn('[data-test--feel-execute="multi"]');
    await studioAgent.assertVisible('[data-test--feel-result="success"]');

    const multiResult = await studioAgent.getText('[data-test--feel-result-value]');
    assert.ok(multiResult.includes('"high"'), `Expected multi-line result to contain "high", got: ${multiResult}`);

    await studioAgent.clickOn('[data-test--feel-execute="single"]');
    await studioAgent.assertVisible('[data-test--feel-result="success"]');

    const singleResult = await studioAgent.getText('[data-test--feel-result-value]');
    assert.ok(singleResult.includes('true'), `Expected single-line result to contain "true", got: ${singleResult}`);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('machine-sanctum/feel_editor: should show error for broken expression', async () => {
    await studioAgent.openUriAsDocument('about:machine-sanctum/feel_editor');
    await studioAgent.assertVisible('[data-test--feel-result="idle"]');

    await studioAgent.clickOn('.cm-content');
    await studioAgent.sendKeyboardInput([SELECT_ALL]);
    await studioAgent.sendKeyboardInput([...'if then'.split('')]);

    await studioAgent.clickOn('[data-test--feel-execute="multi"]');
    await studioAgent.assertVisible('[data-test--feel-result="error"]');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('machine-sanctum/feel_editor: should timeout on infinite loop expression', async () => {
    await studioAgent.openUriAsDocument('about:machine-sanctum/feel_editor');
    await studioAgent.assertVisible('[data-test--feel-result="idle"]');

    await studioAgent.clickOn('.cm-content');
    await studioAgent.sendKeyboardInput([SELECT_ALL]);
    await studioAgent.sendKeyboardInput([...'for a in [1..99999] return for b in [1..99999] return a * b'.split('')]);

    await studioAgent.clickOn('[data-test--feel-execute="multi"]');
    await studioAgent.assertVisible('[data-test--feel-result="timeout"]', 10_000);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
