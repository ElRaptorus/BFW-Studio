import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import React from 'react';

import MenuBarSelect from '../../../src/components/menu_bar/MenuBarSelect';

function renderWithEntryIcons(): string {
  return renderToStaticMarkup(
    React.createElement(MenuBarSelect, {
      command: 'test.select',
      entries: [{ label: 'Local', value: 'e1', icon: 'ph ph-circle', iconLabel: 'Offline' }],
      htmlAttributes: { 'data-menu-bar-item-id': 'test/select' },
      value: 'e1',
      tooltip: 'Offline · http://localhost:4000',
    }),
  );
}

function renderWithoutEntryIcons(): string {
  return renderToStaticMarkup(
    React.createElement(MenuBarSelect, {
      command: 'test.select',
      entries: [{ label: 'Local', value: 'e1' }],
      htmlAttributes: { 'data-menu-bar-item-id': 'test/select' },
      value: 'e1',
      tooltip: 'Offline · http://localhost:4000',
    }),
  );
}

describe('MenuBarSelect', () => {
  it('renders a customizable select when entries carry icons', () => {
    const markup = renderWithEntryIcons();
    expect(markup).toContain('menu-bar__select--with-icons');
    expect(markup).toContain('<button type="button">');
    expect(markup).toContain('<selectedcontent></selectedcontent>');
    expect(markup).toContain('aria-label="Local (Offline)"');
    expect(markup).toContain(
      '<span class="menu-bar__option-icon" aria-hidden="true"><span class="ph ph-circle"></span></span><span class="menu-bar__option-label">Local</span>',
    );
  });

  it('renders a native select when entries have no icons', () => {
    const markup = renderWithoutEntryIcons();
    expect(markup).not.toContain('menu-bar__select--with-icons');
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<span class="menu-bar__option-icon"');
    expect(markup).toContain('Local</option>');
  });

  it('names the select by its tooltip in both modes', () => {
    expect(renderWithEntryIcons()).toContain('aria-label="Offline · http://localhost:4000"');
    expect(renderWithoutEntryIcons()).toContain('aria-label="Offline · http://localhost:4000"');
  });

  it('uses the plain menu-bar element wrapper in both modes', () => {
    expect(renderWithEntryIcons()).toContain('class="menu-bar__element"');
    expect(renderWithoutEntryIcons()).toContain('class="menu-bar__element"');
  });
});
