import type { PaneAreaObject, PaneAreasViewData } from '#bifrost/contracts/PaneTypes';
import { buildLayoutToggleItems } from '#components/header/headerLayoutToggles';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function createArea(visible: boolean, groupCount: number): PaneAreaObject {
  return {
    visible,
    sizeInPixels: 300,
    paneGroups: Array.from({ length: groupCount }, (_, index) => ({
      groupId: `group-${index}`,
      panes: [],
      visible: true,
      activePaneIndex: 0,
    })) as unknown as PaneAreaObject['paneGroups'],
  };
}

function createPaneAreas(left: PaneAreaObject, bottom: PaneAreaObject, right: PaneAreaObject): PaneAreasViewData {
  return { left, bottom, right };
}

describe('buildLayoutToggleItems', () => {
  it('builds one toggle per area that has groups, in left, bottom, right order', () => {
    const items = buildLayoutToggleItems(
      createPaneAreas(createArea(true, 1), createArea(true, 2), createArea(true, 1)),
    );
    assert.deepStrictEqual(
      items.map((item) => item.type === 'button' && item.command),
      ['std.workbench.toggleSidebar', 'std.workbench.toggleInspectorPanel', 'std.workbench.togglePropertyPanel'],
    );
  });

  it('omits areas without groups', () => {
    const items = buildLayoutToggleItems(
      createPaneAreas(createArea(true, 0), createArea(false, 1), createArea(true, 0)),
    );
    assert.deepStrictEqual(
      items.map((item) => item.id),
      ['header-layout-toggle-bottom'],
    );
  });

  it('builds no toggles for a page without pane areas', () => {
    assert.deepStrictEqual(
      buildLayoutToggleItems(createPaneAreas(createArea(true, 0), createArea(true, 0), createArea(true, 0))),
      [],
    );
  });

  it('uses the filled icon and a Hide tooltip while visible, the outline icon and a Show tooltip while hidden', () => {
    const [visibleToggle] = buildLayoutToggleItems(
      createPaneAreas(createArea(true, 1), createArea(true, 0), createArea(true, 0)),
    );
    const [hiddenToggle] = buildLayoutToggleItems(
      createPaneAreas(createArea(false, 1), createArea(true, 0), createArea(true, 0)),
    );
    assert.ok(visibleToggle.type === 'button' && hiddenToggle.type === 'button');
    assert.strictEqual(visibleToggle.icon, 'ph-fill ph-sidebar-simple');
    assert.strictEqual(visibleToggle.tooltip, 'Hide Sidebar');
    assert.strictEqual(hiddenToggle.icon, 'ph ph-sidebar-simple');
    assert.strictEqual(hiddenToggle.tooltip, 'Show Sidebar');
  });

  it('mirrors the right toggle icon', () => {
    const [rightToggle] = buildLayoutToggleItems(
      createPaneAreas(createArea(true, 0), createArea(true, 0), createArea(false, 1)),
    );
    assert.ok(rightToggle.type === 'button');
    assert.strictEqual(rightToggle.icon, 'ph ph-sidebar-simple header-layout-toggle-icon--mirrored');
  });
});
