import { homedir } from 'node:os';
import { join } from 'node:path';
import prompts from 'prompts';

const DEFAULT_PLUGINS_DIR = join(homedir(), '.evil', 'studio', 'plugins');

/**
 * @typedef {{ pluginName: string, displayName: string, description: string, includeWebview: boolean, outputDir: string }} Answers
 */

/**
 * Run interactive prompts, pre-filling from CLI args where provided.
 *
 * @param {string | undefined} nameArg - Plugin name from positional arg
 * @param {{ webview?: boolean, minimal?: boolean, output?: string }} flags - CLI flags
 * @returns {Promise<Answers | null>} Collected answers, or null if cancelled
 */
export async function runPrompts(nameArg, flags) {
  const questions = [];

  if (!nameArg) {
    questions.push({
      type: 'text',
      name: 'pluginName',
      message: 'Plugin name (package name):',
      validate: (v) => (v.length > 0 ? true : 'Name is required'),
    });
  }

  questions.push(
    {
      type: 'text',
      name: 'displayName',
      message: 'Display name:',
      initial: nameArg
        ? nameArg
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : undefined,
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description:',
      initial: '',
    },
  );

  if (!flags.webview && !flags.minimal) {
    questions.push({
      type: 'confirm',
      name: 'includeWebview',
      message: 'Include webview support?',
      initial: false,
    });
  }

  if (!flags.output) {
    questions.push({
      type: 'text',
      name: 'outputDir',
      message: 'Output directory:',
      initial: DEFAULT_PLUGINS_DIR,
    });
  }

  const response = await prompts(questions, { onCancel: () => process.exit(1) });

  return {
    pluginName: nameArg || response.pluginName,
    displayName: response.displayName || nameArg || response.pluginName,
    description: response.description || '',
    includeWebview: flags.webview || (!flags.minimal && response.includeWebview) || false,
    outputDir: flags.output || response.outputDir || DEFAULT_PLUGINS_DIR,
  };
}
