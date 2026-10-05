import { ESLint } from 'eslint';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const studioRoot = path.resolve(import.meta.dirname, '../../..');
const eslint = new ESLint({ cwd: studioRoot });

async function boundaryViolations(importingFile: string, importPath: string): Promise<number> {
  const [result] = await eslint.lintText(`import { probe } from '${importPath}';\nexport { probe };\n`, {
    filePath: path.join(studioRoot, importingFile),
  });
  return result.messages.filter((message) => message.ruleId === 'no-restricted-imports').length;
}

describe('module boundary ESLint zones', () => {
  it.each([
    ['src/bifrost/common/Probe.ts', '#modules/std'],
    ['src/components/Probe.ts', '../modules/std'],
    ['src/modules/std/Probe.ts', '../engine-core'],
    ['src/modules/new-module/Probe.ts', '#modules/engine-core'],
    ['src/modules/dmn-editor/Probe.ts', '#modules/bpmn-editor/BpmnDocumentModel'],
    ['src/modules/dmn-editor/merge/Probe.ts', '../../bpmn-linter/index'],
    ['src/modules/bpmn-editor/Probe.ts', '#modules/dmn-decision-simulator'],
    ['src/modules/bpmn-editor/Probe.ts', '#modules/git-cruiser/GitTypes'],
    ['src/modules/dmn-core/Probe.ts', '#modules/engine-core'],
  ])('%s may not import %s', async (importingFile, importPath) => {
    expect(await boundaryViolations(importingFile, importPath)).toBe(1);
  });

  it.each([
    ['src/modules/dmn-editor/Probe.ts', '#modules/bpmn-core'],
    ['src/modules/dmn-editor/merge/Probe.ts', '../../bpmn-core/diff/styles/component.bpmn-merge.scss'],
    ['src/modules/bpmn-editor/Probe.ts', '#modules/dmn-core'],
    ['src/modules/bpmn-linter/Probe.ts', '#modules/bpmn-editor/BpmnDocumentModel'],
    ['src/modules/std/Probe.ts', '#modules/bpmn-editor'],
    ['src/modules/engine-debugger/Probe.ts', '#modules/bpmn-editor'],
    ['src/modules/git-cruiser/Probe.ts', '#bifrost/contracts/MergeTypes'],
  ])('%s may import %s', async (importingFile, importPath) => {
    expect(await boundaryViolations(importingFile, importPath)).toBe(0);
  });
});
