import * as assert from 'node:assert';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';
import { createAndStartStudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';

const ASSERT_VISIBLE_TIMEOUT = 30000;
const PROBLEMS_PANE = '[data-test--pane="bpmn-linter/panes/ProblemsPane"]';

async function getFindingMessages(studioAgent: StudioAgentBpmnExtension): Promise<string[]> {
  return studioAgent.executeInRenderer(
    `return Array.from(document.querySelectorAll('${PROBLEMS_PANE} .lint-problems-item__message')).map((el) => el.textContent ?? '')`,
  ) as Promise<string[]>;
}

describe('bpmn-linter/adhoc-rules', { timeout: 20_000 }, () => {
  let studioAgent: StudioAgentBpmnExtension;

  beforeAll(async () => {
    const ctx = { testName: 'setup', testFile: __filename };
    studioAgent = await createAndStartStudioAgentBpmnExtension(ctx);
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');
    await studioAgent.maximize();

    // The linter is disabled by default; enable it with the production-ready profile
    // (both ad-hoc rules are `error` there) so violations surface deterministically.
    await studioAgent.executeInRenderer(
      "bifrost.settings.set('bpmnLinter.profile', 'bpmn-production-ready'); bifrost.settings.set('bpmnLinter.enabled', true);",
    );
  });

  beforeEach(({ task }) => {
    studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent.recordErrors();
    await studioAgent.closeOpenEditors();
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  it('bpmn-linter/adhoc-rules: should report a config violation for an ad-hoc sub-process without completion condition or implementation', async () => {
    await studioAgent.jumpToFileInSolution('adhoc-subprocess.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.switchToPaneGroup('linter');
    await studioAgent.assertPaneVisible('bpmn-linter/panes/ProblemsPane');

    await studioAgent.assertVisible('.lint-problems-item', ASSERT_VISIBLE_TIMEOUT);

    const messages = await getFindingMessages(studioAgent);

    assert.ok(
      messages.some((message) => message.includes('no completion condition and no implementation')),
      `Expected a finding about missing completion condition/implementation, got: ${JSON.stringify(messages)}`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn-linter/adhoc-rules: should report a structure violation for an ad-hoc sub-process containing a start event', async () => {
    await studioAgent.jumpToFileInSolution('adhoc-subprocess-invalid.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();

    await studioAgent.switchToPaneGroup('linter');
    await studioAgent.assertPaneVisible('bpmn-linter/panes/ProblemsPane');

    await studioAgent.assertVisible('.lint-problems-item', ASSERT_VISIBLE_TIMEOUT);

    const messages = await getFindingMessages(studioAgent);

    assert.ok(
      messages.some((message) => message.toLowerCase().includes('start event')),
      `Expected a finding about a start event inside the ad-hoc sub-process, got: ${JSON.stringify(messages)}`,
    );

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
