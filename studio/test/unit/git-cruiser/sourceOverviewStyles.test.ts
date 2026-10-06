import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceDirectory = path.resolve(__dirname, '../../../src');

const COLOUR_LITERAL =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(|(?<![\w-])(?:red|green|blue|white|black|gray|grey|orange|yellow|purple|pink|brown|cyan|magenta)(?![\w-])/;

/** The value of every declaration in the text; selectors and comments are not looked at. */
function readDeclarationValues(styles: string): string[] {
  return styles
    .split('\n')
    .map((line) => line.match(/^\s*[\w-]+\s*:\s*(.+?);/)?.[1])
    .filter((value): value is string => value != null);
}

function readStyles(relativePath: string): string {
  return readFileSync(path.join(sourceDirectory, relativePath), 'utf8');
}

describe('styles of the Source page', () => {
  it.each([
    'modules/git-cruiser/overview/styles/source-overview.scss',
    'modules/git-cruiser/textDiff/styles/component.text-diff.scss',
  ])('%s takes every colour from a theme token', (relativePath) => {
    const literals = readDeclarationValues(readStyles(relativePath)).filter((value) => COLOUR_LITERAL.test(value));
    expect(literals).toEqual([]);
  });

  it('the merge view colours of the code editor are aliases of core tokens', () => {
    const styles = readStyles('components/code-editor/component.code-editor.scss');
    const mergeViewStart = styles.indexOf('`@codemirror/merge` ships fixed');
    expect(mergeViewStart).toBeGreaterThan(-1);

    const aliasLines = styles.split('\n').filter((line) => line.includes('--theme-cm-diff-'));
    const relevantStyles = [...aliasLines, styles.substring(mergeViewStart)].join('\n');
    expect(readDeclarationValues(relevantStyles).length).toBeGreaterThan(0);
    expect(readDeclarationValues(relevantStyles).filter((value) => COLOUR_LITERAL.test(value))).toEqual([]);
  });

  it('the literal check recognizes a colour literal', () => {
    expect(COLOUR_LITERAL.test('1px solid #fff')).toBe(true);
    expect(COLOUR_LITERAL.test('rgba(0, 0, 0, 0.5)')).toBe(true);
    expect(COLOUR_LITERAL.test('white')).toBe(true);
    expect(COLOUR_LITERAL.test('nowrap')).toBe(false);
    expect(COLOUR_LITERAL.test('1px solid var(--theme-border)')).toBe(false);
  });
});
