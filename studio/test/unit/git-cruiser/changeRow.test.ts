import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import React from 'react';

import { ChangeRow } from '../../../src/modules/git-cruiser/overview/components/ChangeRow';

const unchanged = {
  fileChange: 'modified',
  modelName: 'Order',
  addedElementNames: [] as string[],
  removedElementNames: [] as string[],
  modifiedElementNames: [] as string[],
  layoutChangedCount: 0,
  fileDetailsChanged: false,
};

function render(digest: any, filePath = 'order.bpmn', status = 'modified'): string {
  const file = { path: filePath, previousPath: null, status, beforeRef: 'HEAD', afterRef: 'WORKING' } as any;
  // React separates adjacent text nodes with comments; the user never sees them
  return renderToStaticMarkup(
    React.createElement(ChangeRow, {
      bifrost: {} as any,
      repositoryRoot: '/work/repository',
      file,
      digest,
      onSummarize: () => undefined,
    }),
  ).replaceAll('<!-- -->', '');
}

const ready = (overrides: Record<string, unknown>) => ({ kind: 'ready', digest: { ...unchanged, ...overrides } });

describe('ChangeRow', () => {
  it('names new and deleted models', () => {
    expect(render(ready({ fileChange: 'added', addedElementNames: ['a'] }))).toContain('New model');
    expect(render(ready({ fileChange: 'deleted' }))).toContain('Deleted model');
  });

  it('lists added, changed, removed, layout and file details in that order, with the first element names', () => {
    const markup = render(
      ready({
        addedElementNames: ['a', 'b'],
        removedElementNames: ['c'],
        modifiedElementNames: ['d'],
        layoutChangedCount: 1,
        fileDetailsChanged: true,
      }),
    );
    expect(markup).toContain('2 added · 1 changed · 1 removed · layout moved · file details changed: a, b, d');
  });

  it('shortens a long list of element names', () => {
    expect(render(ready({ addedElementNames: ['a', 'b', 'c', 'd', 'e'] }))).toContain('5 added: a, b, c and 2 more');
  });

  it('shows only the parts that occurred, and says so when nothing changed', () => {
    expect(render(ready({ layoutChangedCount: 4 }))).toContain('>layout moved<');
    expect(render(ready({}))).toContain('No content changes');
  });

  it('shows the loading and failed states of the summary', () => {
    expect(render({ kind: 'loading' })).toContain('Summarizing…');
    expect(render({ kind: 'failed' })).toContain('This file could not be summarized.');
  });

  it('offers to summarize only a model file that has no summary yet', () => {
    expect(render(null)).toContain('data-test--change-row-summarize');
    expect(render(null, 'notes.txt')).not.toContain('data-test--change-row-summarize');
    expect(render({ kind: 'loading' })).not.toContain('data-test--change-row-summarize');
  });

  it('keeps the actions beside the main button instead of inside it', () => {
    const markup = render(null);
    const mainButton = markup.substring(markup.indexOf('<button'), markup.indexOf('</button>'));
    expect(mainButton).toContain('source-overview__change-main');
    expect(mainButton.split('<button')).toHaveLength(2);
    expect(mainButton).not.toContain('data-test--change-row-open');
    expect(markup).toContain('data-test--change-row-open');
  });
});
