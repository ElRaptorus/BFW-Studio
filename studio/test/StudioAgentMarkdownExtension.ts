import * as path from 'path';

import type { TestContext } from './StudioAgent';
import { ASSERT_VISIBLE_TIMEOUT, StudioAgent, createAndStartStudioAgent } from './StudioAgent';

function getFixtures(fixtureName: string): string {
  return path.join(__dirname, 'fixtures', fixtureName);
}

function getFixturesFilename(fixtureName: string, filename: string): string {
  return path.join(__dirname, 'fixtures', fixtureName, filename);
}

export async function createAndStartStudioAgentMarkdownExtension(
  testContext: TestContext,
  solutionFixtureName?: string,
  filename?: string,
): Promise<StudioAgentMarkdownExtension> {
  const additionalCliArgs: string[] = [];

  if (solutionFixtureName) {
    additionalCliArgs.push('--test-solution=' + getFixtures(solutionFixtureName));

    if (filename) {
      additionalCliArgs.push('--test-file=' + getFixturesFilename(solutionFixtureName, filename));
    }
  }

  const bpmnExtensionAgent = await createAndStartStudioAgent<StudioAgentMarkdownExtension>(
    testContext,
    StudioAgentMarkdownExtension,
    additionalCliArgs,
  );

  return bpmnExtensionAgent;
}

export class StudioAgentMarkdownExtension extends StudioAgent {
  async waitForInteractiveMarkdownDocument(timeout: number = ASSERT_VISIBLE_TIMEOUT): Promise<true> {
    const element = this.testDriver.client!.$('[data-test--mdx-document-editor-visible="true"]');
    return element.waitForExist({ timeout: timeout });
  }
}
