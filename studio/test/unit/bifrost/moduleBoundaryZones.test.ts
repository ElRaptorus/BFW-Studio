import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const studioRoot = path.resolve(import.meta.dirname, '../../..');
const oxlintBinary = path.join(studioRoot, 'node_modules', '.bin', 'oxlint');

const forbiddenCases: [string, string][] = [
  ['src/bifrost/common/Probe.ts', '#modules/std'],
  ['src/components/Probe.ts', '../modules/std'],
  ['src/modules/std/Probe.ts', '../engine-core'],
  ['src/modules/new-module/Probe.ts', '#modules/engine-core'],
  ['src/modules/dmn-editor/Probe.ts', '#modules/bpmn-editor/BpmnDocumentModel'],
  ['src/modules/dmn-editor/merge/Probe.ts', '../../bpmn-linter/index'],
  ['src/modules/bpmn-editor/Probe.ts', '#modules/dmn-decision-simulator'],
  ['src/modules/bpmn-editor/Probe.ts', '#modules/git-cruiser/GitTypes'],
  ['src/modules/dmn-core/Probe.ts', '#modules/engine-core'],
  ['src/bifrost/common/Probe.ts', '../../../test/unit/support/x'],
  ['src/modules/engine-deploy/Probe.ts', '../../../test/x'],
  ['src/types/Probe.ts', '../../test/x'],
];

const allowedCases: [string, string][] = [
  ['src/modules/dmn-editor/Probe.ts', '#modules/bpmn-core'],
  ['src/modules/dmn-editor/merge/Probe.ts', '../../bpmn-core/diff/styles/component.bpmn-merge.scss'],
  ['src/modules/bpmn-editor/Probe.ts', '#modules/dmn-core'],
  ['src/modules/bpmn-linter/Probe.ts', '#modules/bpmn-editor/BpmnDocumentModel'],
  ['src/modules/std/Probe.ts', '#modules/bpmn-editor'],
  ['src/modules/engine-debugger/Probe.ts', '#modules/bpmn-editor'],
  ['src/modules/git-cruiser/Probe.ts', '#bifrost/contracts/MergeTypes'],
];

// Oxlint cannot lint text from memory and resolves override globs relative to its config file. The probe files
// therefore live in a temporary tree next to a copy of the studio config, and one Oxlint run lints all of them.
const probeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'module-boundary-zones-'));
const filesWithViolation = new Set<string>();

function probeFileName(importingFile: string, caseIndex: number): string {
  return importingFile.replace('Probe.ts', `Probe${caseIndex}.ts`);
}

beforeAll(() => {
  const studioConfig = JSON.parse(fs.readFileSync(path.join(studioRoot, '.oxlintrc.json'), 'utf8'));
  studioConfig.extends = [path.resolve(studioRoot, '..', 'oxlintrc.base.json')];
  fs.writeFileSync(path.join(probeDirectory, '.oxlintrc.json'), JSON.stringify(studioConfig));

  [...forbiddenCases, ...allowedCases].forEach(([importingFile, importPath], caseIndex) => {
    const filePath = path.join(probeDirectory, probeFileName(importingFile, caseIndex));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `import { probe } from '${importPath}';\nexport { probe };\n`);
  });

  // Exit code 1 means "diagnostics found", which is the expected outcome here.
  const result = spawnSync(oxlintBinary, ['--format', 'json', 'src'], { cwd: probeDirectory, encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: { code: string; filename: string }[] };
  // Oxlint reports one restricted import twice, so the check is "flagged or not", not a count.
  for (const diagnostic of diagnostics) {
    if (diagnostic.code.includes('no-restricted-imports')) {
      filesWithViolation.add(diagnostic.filename);
    }
  }
});

afterAll(() => {
  fs.rmSync(probeDirectory, { recursive: true, force: true });
});

function hasBoundaryViolation(importingFile: string, caseIndex: number): boolean {
  return filesWithViolation.has(probeFileName(importingFile, caseIndex));
}

describe('module boundary Oxlint zones', () => {
  it.each(
    forbiddenCases.map(([importingFile, importPath], caseIndex) => [importingFile, importPath, caseIndex] as const),
  )('%s may not import %s', (importingFile, _importPath, caseIndex) => {
    expect(hasBoundaryViolation(importingFile, caseIndex)).toBe(true);
  });

  it.each(
    allowedCases.map(
      ([importingFile, importPath], allowedIndex) =>
        [importingFile, importPath, forbiddenCases.length + allowedIndex] as const,
    ),
  )('%s may import %s', (importingFile, _importPath, caseIndex) => {
    expect(hasBoundaryViolation(importingFile, caseIndex)).toBe(false);
  });
});
