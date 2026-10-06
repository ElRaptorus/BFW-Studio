import { describe, expect, it, vi } from 'vitest';

import { DiagnosticsManager } from '../../../src/bifrost/common/DiagnosticsManager';
import { initializeStatusBarItems } from '../../../src/modules/std/initializers/initializeStatusBarItems';

function renderProblemsItem(focusedUri: string | undefined) {
  const diagnostics = new DiagnosticsManager();
  diagnostics.setDiagnostics('file:///rules.dmn', 'linter', [
    { severity: 'error', message: 'broken', source: 'linter' },
    { severity: 'warning', message: 'odd', source: 'linter' },
  ]);

  const render: Record<string, () => any[]> = {};
  const noopEmitter = { on: vi.fn() };
  const bifrost = {
    theme: noopEmitter,
    diagnostics: Object.assign(diagnostics, { on: vi.fn() }),
    editors: { on: vi.fn(), getFocusedEditorDocument: () => (focusedUri ? { uri: focusedUri } : null) },
    statusBar: {
      updateStatusBarItems: vi.fn(),
      registerStatusBarItem: (_area: string, id: string, renderItem: () => any[]) => {
        render[id] = renderItem;
      },
    },
  } as any;

  initializeStatusBarItems(bifrost);
  return render['std/problems']()[0]
    .content.filter((part: any) => part.type === 'text')
    .map((part: any) => part.label);
}

describe('problems status bar item', () => {
  it('shows the counts of the focused document', () => {
    expect(renderProblemsItem('file:///rules.dmn')).toEqual(['1', '1']);
  });

  it('shows zero for a focused document without diagnostics', () => {
    expect(renderProblemsItem('git-cruiser://source-overview')).toEqual(['0', '0']);
  });

  it('shows zero when no document is focused', () => {
    expect(renderProblemsItem(undefined)).toEqual(['0', '0']);
  });
});
