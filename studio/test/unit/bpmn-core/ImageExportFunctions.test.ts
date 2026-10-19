import { getImageFormatForFilename, replaceThemeColorsInSvg } from '#modules/bpmn-core/ImageExportFunctions';
import assert from 'node:assert';
import { describe, it } from 'vitest';

describe('replaceThemeColorsInSvg', () => {
  it('replaces the BPMN and DMN theme colour variables with white fill and black stroke', () => {
    const svg =
      '<svg><rect fill="var(--color-dmn-defaultFillColor)" stroke="var(--color-dmn-defaultStrokeColor)"/>' +
      '<text style="fill: var(--color-bpmn-defaultStrokeColor)"/>' +
      '<circle fill="var(--color-bpmn-defaultFillColor)"/></svg>';

    assert.strictEqual(
      replaceThemeColorsInSvg(svg),
      '<svg><rect fill="white" stroke="black"/><text style="fill: black"/><circle fill="white"/></svg>',
    );
  });

  it('keeps explicit element colours', () => {
    const svg = '<svg><rect fill="#bbdefb" stroke="rgb(30, 136, 229)"/></svg>';

    assert.strictEqual(replaceThemeColorsInSvg(svg), svg);
  });
});

describe('getImageFormatForFilename', () => {
  it('maps each supported extension to its format', () => {
    assert.strictEqual(getImageFormatForFilename('/home/user/diagram.png'), 'png');
    assert.strictEqual(getImageFormatForFilename('/home/user/diagram.jpg'), 'jpeg');
    assert.strictEqual(getImageFormatForFilename('/home/user/diagram.jpeg'), 'jpeg');
    assert.strictEqual(getImageFormatForFilename('/home/user/diagram.webp'), 'webp');
    assert.strictEqual(getImageFormatForFilename('/home/user/diagram.svg'), 'svg');
  });

  it('ignores the case of the extension', () => {
    assert.strictEqual(getImageFormatForFilename('C:\\Users\\user\\Diagram.PNG'), 'png');
    assert.strictEqual(getImageFormatForFilename('diagram.JpEg'), 'jpeg');
  });

  it('uses only the last extension', () => {
    assert.strictEqual(getImageFormatForFilename('diagram.svg.png'), 'png');
    assert.strictEqual(getImageFormatForFilename('diagram.png.bpmn'), null);
  });

  it('returns null for a missing or unsupported extension', () => {
    assert.strictEqual(getImageFormatForFilename('/home/user/diagram'), null);
    assert.strictEqual(getImageFormatForFilename('/home/user/diagram.gif'), null);
    assert.strictEqual(getImageFormatForFilename('/home/user/diagram.'), null);
    assert.strictEqual(getImageFormatForFilename('/home/user/.png'), null);
  });

  it('does not read an extension from a directory name', () => {
    assert.strictEqual(getImageFormatForFilename('/home/user/exports.png/diagram'), null);
    assert.strictEqual(getImageFormatForFilename('C:\\exports.svg\\diagram'), null);
  });
});
