import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StudioAgent } from '../../StudioAgent';
import { createAndStartStudioAgent } from '../../StudioAgent';

const EDITOR = '[data-test-settings]';
const LINT_WAIT = { timeout: 10_000 };

describe('settings JSON editor', () => {
  let studioAgent: StudioAgent;

  beforeEach(async ({ task }) => {
    studioAgent = await createAndStartStudioAgent({ testName: task.name, testFile: __filename });
    await studioAgent.openUriAsDocument('about:settings-json');
    await studioAgent.assertVisible(`${EDITOR} .cm-content`);
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent?.stopAndRecordErrors();
  });

  it('lints, describes and completes settings from their descriptors', async () => {
    await studioAgent.clickOnCodeEditor(EDITOR);
    await studioAgent.sendKeyboardInput(
      '{"no.such": 1, "bpmn.editor.showGrid": "yes", "std.fileExplorer.exclude": ["a", 2]'.split(''),
    );

    await studioAgent.waitUntil(
      async () => (await studioAgent.getElementCount(`${EDITOR} .cm-lintRange-error`)) === 2,
      {
        ...LINT_WAIT,
        timeoutMsg: 'Expected errors on "yes" and on the list item 2',
      },
    );
    expect(await studioAgent.getText(`${EDITOR} .cm-lintRange-warning`)).toBe('"no.such"');
    expect(await studioAgent.getText(`${EDITOR} .cm-lintRange-error`)).toBe('"yes"');

    await studioAgent.hoverOn(`${EDITOR} .cm-lintRange-error`);
    await studioAgent.assertVisible(`${EDITOR} .cm-json-assist-hover`);
    expect(await studioAgent.getText(`${EDITOR} .cm-json-assist-hover`)).toContain(
      'Display a grid overlay on the BPMN canvas.',
    );

    await studioAgent.sendKeyboardInput(', "bpmn.editor.showDoc'.split(''));
    await studioAgent.sendKeyboardInput(['ctrl-space'], false);
    await studioAgent.assertVisible(`${EDITOR} .cm-tooltip-autocomplete`);
    expect(await studioAgent.getText(`${EDITOR} .cm-tooltip-autocomplete`)).toContain(
      'bpmn.editor.showDocumentationMarker',
    );
    await studioAgent.sendKeyboardInput(['enter'], false);
    expect(await studioAgent.getCodeEditorText(EDITOR)).toContain('"bpmn.editor.showDocumentationMarker": true}');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('flags JSON5-only syntax that saving would reject and fixes it', async () => {
    await studioAgent.clickOnCodeEditor(EDITOR);
    await studioAgent.sendKeyboardInput('{a: 1'.split(''));

    await studioAgent.waitUntil(
      async () => (await studioAgent.getElementCount(`${EDITOR} .cm-lintRange-error`)) === 1,
      { ...LINT_WAIT, timeoutMsg: 'Expected an error on the unquoted key' },
    );
    expect(await studioAgent.getText(`${EDITOR} .cm-lintRange-error`)).toBe('a');

    await studioAgent.hoverOn(`${EDITOR} .cm-lintRange-error`);
    await studioAgent.clickOn(`${EDITOR} .cm-tooltip-lint .cm-diagnosticAction`);
    expect(await studioAgent.getCodeEditorText(EDITOR)).toBe('{"a": 1}');
    await studioAgent.waitUntil(
      async () => (await studioAgent.getElementCount(`${EDITOR} .cm-lintRange-warning`)) === 1,
      { ...LINT_WAIT, timeoutMsg: 'Expected the unknown-setting warning on the quoted key' },
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
