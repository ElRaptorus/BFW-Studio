import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import { ASSERT_VISIBLE_TIMEOUT } from '../../StudioAgent';
import type { StudioAgentMarkdownExtension } from '../../StudioAgentMarkdownExtension';
import { createAndStartStudioAgentMarkdownExtension } from '../../StudioAgentMarkdownExtension';

describe('mdx/smoke', { timeout: 20_000 }, () => {
  let studioAgent: StudioAgentMarkdownExtension;

  beforeAll(async () => {
    studioAgent = await createAndStartStudioAgentMarkdownExtension(
      { testName: 'setup', testFile: __filename },
      'test-solution-markdown',
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

  it('mdx/smoke/open: should open an ".md" file', async () => {
    await studioAgent.jumpToFileInSolution('TestMarkdownFile2.md', 'editor-document-markdown-editor');
    await studioAgent.waitForInteractiveMarkdownDocument();
    await studioAgent.assertVisible('[data-test--mdx-document-editor-visible]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('mdx/smoke/open: should open an ".mdx" file', async () => {
    await studioAgent.jumpToFileInSolution('TestMarkdownFile1.mdx', 'editor-document-markdown-editor');
    await studioAgent.waitForInteractiveMarkdownDocument();
    await studioAgent.assertVisible('[data-test--mdx-document-editor-visible]', ASSERT_VISIBLE_TIMEOUT);
    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
