import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

const stylesDirectory = path.resolve(__dirname, '../../../src/bifrost/styles');
const bpmnEditorStyles = path.resolve(__dirname, '../../../src/modules/bpmn-editor/styles/bpmn.scss');

describe('theme token ownership', () => {
  const coreStyles = readdirSync(stylesDirectory)
    .filter((fileName) => fileName.endsWith('.scss'))
    .map((fileName) => readFileSync(path.join(stylesDirectory, fileName), 'utf8'))
    .join('\n');

  it('keeps the BPMN editor color picker and the bpmn-js palette out of core styles', () => {
    assert.equal(coreStyles.includes('--theme-color-picker-'), false);
    assert.equal(coreStyles.includes('--color-bpmn-editor-'), false);
    assert.equal(coreStyles.includes('.color-picker-panel'), false);
    assert.equal(coreStyles.includes('.djs-palette'), false);
  });

  it('keeps the color-picker tokens in the BPMN editor stylesheet', () => {
    const editorStyles = readFileSync(bpmnEditorStyles, 'utf8');
    assert.equal(editorStyles.includes('--theme-color-picker-'), true);
    assert.equal(editorStyles.includes('--color-bpmn-editor-icon-primary'), true);
  });
});
