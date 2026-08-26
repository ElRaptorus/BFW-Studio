import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

import { ThemeToken } from '@evil/bifrost_fw_sdk';

const cssPath = path.resolve(__dirname, '../../../../studio-sdk/src/webview/studio-webview-theme.css');

describe('ThemeToken contract', () => {
  const css = readFileSync(cssPath, 'utf8');
  const tokenValues = Object.values(ThemeToken);

  it('every ThemeToken value uses the --theme- prefix', () => {
    for (const value of tokenValues) {
      assert.ok(value.startsWith('--theme-'), `expected --theme- prefix, got ${value}`);
    }
  });

  it('every ThemeToken value appears in studio-webview-theme.css', () => {
    const missing = tokenValues.filter((value) => !css.includes(`${value}:`));
    assert.deepStrictEqual(missing, [], `CSS is missing ThemeToken entries: ${missing.join(', ')}`);
  });

  it('includes FEEL and table tokens forwarded after Table is internalized', () => {
    assert.strictEqual(ThemeToken.FeelBg, '--theme-feel-bg');
    assert.strictEqual(ThemeToken.TableBg, '--theme-table-bg');
    assert.ok(css.includes('--theme-feel-bg:'));
    assert.ok(css.includes('--theme-table-bg:'));
  });
});
