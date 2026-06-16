import * as assert from 'assert';
import 'mocha';
import { createRoot } from 'react-dom/client';

import React from 'react';

import { Icon } from './Icon';

describe('<Icon />', () => {
  it('renders without crashing', () => {
    const div = document.createElement('div');
    const root = createRoot(div);
    root.render(<Icon id="ph-fill ph-star" />);
    root.unmount();
  });

  it('can register a new icon', () => {
    Icon.registerIcon('test my-icon', <svg data-test-my-icon></svg>);

    const div = document.createElement('div');
    const root = createRoot(div);
    root.render(<Icon id="test my-icon" />);

    const elements = div.querySelectorAll('svg[data-test-my-icon]');
    assert.deepStrictEqual(1, elements.length);

    root.unmount();
  });

  it('can register a new icon under a CSS class alias and use it', () => {
    Icon.registerIcon('test my-icon', 'ph-fill ph-star x-my-appended-modifier-class');

    const div = document.createElement('div');
    const root = createRoot(div);
    root.render(<Icon id="test my-icon" />);

    const elements = div.querySelectorAll('span.x-my-appended-modifier-class');
    assert.deepStrictEqual(1, elements.length);

    root.unmount();
  });

  it('can register a new icon under an alias for an existing one and use it', () => {
    Icon.registerIcon('test my-icon', 'ph-fill ph-star x-my-appended-modifier-class');
    Icon.registerIcon('test my-alias', 'test my-icon');

    const div = document.createElement('div');
    const root = createRoot(div);
    root.render(<Icon id="test my-alias" />);

    const elements = div.querySelectorAll('span.x-my-appended-modifier-class');
    assert.deepStrictEqual(1, elements.length);

    root.unmount();
  });
});
