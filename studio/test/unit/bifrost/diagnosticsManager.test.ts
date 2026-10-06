import { describe, expect, it } from 'vitest';

import { DiagnosticsManager } from '../../../src/bifrost/common/DiagnosticsManager';

describe('DiagnosticsManager.getCount', () => {
  function createManager() {
    const manager = new DiagnosticsManager();
    manager.setDiagnostics('file:///a.dmn', 'linter', [
      { severity: 'error', message: 'one', source: 'linter' },
      { severity: 'warning', message: 'two', source: 'linter' },
    ]);
    manager.setDiagnostics('file:///b.bpmn', 'linter', [{ severity: 'error', message: 'three', source: 'linter' }]);
    return manager;
  }

  it('counts every URI when none is given', () => {
    expect(createManager().getCount()).toEqual({ errors: 2, warnings: 1, infos: 0 });
  });

  it('counts only the given URI', () => {
    expect(createManager().getCount('file:///a.dmn')).toEqual({ errors: 1, warnings: 1, infos: 0 });
  });

  it('counts nothing for an unknown URI', () => {
    expect(createManager().getCount('file:///unknown')).toEqual({ errors: 0, warnings: 0, infos: 0 });
  });
});
