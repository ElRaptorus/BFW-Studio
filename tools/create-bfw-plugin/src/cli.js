#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { runPrompts } from './prompts.js';
import { generate } from './generator.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    webview: { type: 'boolean', default: false },
    minimal: { type: 'boolean', default: false },
    output: { type: 'string', short: 'o' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`
Usage: create-bfw-plugin [name] [options]

Options:
  --webview          Include webview template (skip prompt)
  --minimal          No webview (skip prompt)
  -o, --output DIR   Output directory (default: ~/.evil/studio/plugins)
  -h, --help         Show this help message
`);
  process.exit(0);
}

const nameArg = positionals[0];
const answers = await runPrompts(nameArg, values);

if (answers == null) {
  process.exit(1);
}

await generate(answers);
