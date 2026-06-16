import * as assert from 'node:assert';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

import type { StudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';
import { createAndStartStudioAgentBpmnExtension } from '../../StudioAgentBpmnExtension';

const ASSERT_VISIBLE_TIMEOUT = 30000;
const SUBPROCESS_CONTEXT_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesSubprocessContext"]';
const DEFINITION_PANE = '[data-test--pane="bpmn/panes/properties/PropertiesDefinition"]';

describe('bpmn/drilldown', { timeout: 20_000 }, () => {
  let studioAgent: StudioAgentBpmnExtension;

  beforeAll(async () => {
    const ctx = { testName: 'setup', testFile: __filename };
    studioAgent = await createAndStartStudioAgentBpmnExtension(ctx);
    await studioAgent.openFixturesDirectoryAsSolution('test-solution-bpmn');
    await studioAgent.maximize();
  });

  beforeEach(async ({ task }) => {
    studioAgent.updateTestContext({ testName: task.name, testFile: __filename });
    await studioAgent.jumpToFileInSolution('collapsed-subprocess.bpmn');
    await studioAgent.waitForInteractiveBpmnDocument();
  });

  afterEach(async ({ task }) => {
    studioAgent.updateTestContext({
      testName: task.name,
      testFile: __filename,
      state: task.result?.state === 'fail' ? 'failed' : 'passed',
    });
    await studioAgent.recordErrors();
    await studioAgent.closeOpenEditors();
  });

  afterAll(async () => {
    await studioAgent?.stop();
  });

  // ─── Diagnostic: verify planes exist after import ───────────────────

  it('bpmn/drilldown/planes: should create a plane for the collapsed subprocess during import', async () => {
    const rootId = await studioAgent.getBpmnCanvasRootId();
    assert.ok(rootId != null, 'Canvas should have a root element');

    const isInSubprocess = await studioAgent.isInsideSubprocessPlane();
    assert.strictEqual(isInSubprocess, false, 'Should start on the root plane');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/drilldown/overlay: should render a drill-down overlay on the collapsed subprocess', async () => {
    const overlayCount = await studioAgent.getDrilldownOverlayCount();
    assert.ok(overlayCount > 0, `Expected at least one .bjs-drilldown overlay, found ${overlayCount}`);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Command-based drill-down (bypasses UI click) ───────────────────

  it('bpmn/drilldown/command: should drill into subprocess via bpmn.editor.drillDown command', async () => {
    await studioAgent.drillDownIntoSubprocess('SubProcess_Collapsed');

    const isInSubprocess = await studioAgent.isInsideSubprocessPlane();
    assert.strictEqual(isInSubprocess, true, 'Should be inside the subprocess plane after drill-down');

    const rootId = await studioAgent.getBpmnCanvasRootId();
    assert.strictEqual(rootId, 'SubProcess_Collapsed_plane', 'Root should be the subprocess plane');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/drilldown/command: should drill back up via bpmn.editor.drillUp command', async () => {
    await studioAgent.drillDownIntoSubprocess('SubProcess_Collapsed');

    const isInSubprocessBefore = await studioAgent.isInsideSubprocessPlane();
    assert.strictEqual(isInSubprocessBefore, true, 'Should be inside subprocess before drill-up');

    await studioAgent.drillUpFromSubprocess();

    const isInSubprocessAfter = await studioAgent.isInsideSubprocessPlane();
    assert.strictEqual(isInSubprocessAfter, false, 'Should be back on root plane after drill-up');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Breadcrumbs ────────────────────────────────────────────────────

  it('bpmn/drilldown/breadcrumbs: should show breadcrumb bar when drilled into a subprocess', async () => {
    await studioAgent.drillDownIntoSubprocess('SubProcess_Collapsed');

    await studioAgent.assertBreadcrumbsVisible(ASSERT_VISIBLE_TIMEOUT);

    const items = await studioAgent.$$('[data-test--bpmn-breadcrumb-bar] .bpmn-breadcrumb-bar__item');
    assert.ok(items.length >= 2, `Expected at least 2 breadcrumb items (process + subprocess), found ${items.length}`);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/drilldown/breadcrumbs: should not show breadcrumb bar on the root plane', async () => {
    await studioAgent.assertBreadcrumbsNotVisible();

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/drilldown/breadcrumbs: should navigate back to root when clicking the process breadcrumb', async () => {
    await studioAgent.drillDownIntoSubprocess('SubProcess_Collapsed');
    await studioAgent.assertBreadcrumbsVisible(ASSERT_VISIBLE_TIMEOUT);

    const items = await studioAgent.$$('[data-test--bpmn-breadcrumb-bar] .bpmn-breadcrumb-bar__item');
    assert.ok(items.length >= 2, 'Expected at least 2 breadcrumb items');
    await items[0].click();

    const isInSubprocess = await studioAgent.isInsideSubprocessPlane();
    assert.strictEqual(isInSubprocess, false, 'Should be back on root plane after clicking process breadcrumb');

    await studioAgent.assertBreadcrumbsNotVisible();

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Overlay click drill-down ───────────────────────────────────────

  it('bpmn/drilldown/diagnostic: DOM inspection of drill-down overlay and click chain', async () => {
    const diagnostic = (await studioAgent.executeInRenderer(`return (function() {
      var subprocessId = 'SubProcess_Collapsed';
      var result = {};

      var overlayContainer = document.querySelector('.djs-overlays[data-container-id="' + subprocessId + '"]');
      result.overlayContainerExists = overlayContainer != null;
      if (!overlayContainer) return result;

      var allWrappers = Array.from(overlayContainer.querySelectorAll(':scope > .djs-overlay'));
      result.wrapperCount = allWrappers.length;
      result.wrappers = allWrappers.map(function(wrapper) {
        var style = wrapper.style;
        var computed = window.getComputedStyle(wrapper);
        var rect = wrapper.getBoundingClientRect();
        return {
          className: wrapper.className,
          overlayId: wrapper.getAttribute('data-overlay-id'),
          inlinePointerEvents: style.pointerEvents || '(not set)',
          computedPointerEvents: computed.pointerEvents,
          computedZIndex: computed.zIndex,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          childCount: wrapper.children.length,
          children: Array.from(wrapper.children).map(function(child) {
            var cc = window.getComputedStyle(child);
            return {
              tag: child.tagName, id: child.id || '(none)', className: (child.className || '').toString().substring(0, 80),
              inlinePE: child.style.pointerEvents || '(not set)', computedPE: cc.pointerEvents
            };
          })
        };
      });

      var btn = overlayContainer.querySelector('.bjs-drilldown');
      result.drilldownButtonExists = btn != null;
      if (btn) {
        var bc = window.getComputedStyle(btn);
        var br = btn.getBoundingClientRect();
        result.drilldownButton = {
          tag: btn.tagName, title: btn.getAttribute('title'),
          computedPE: bc.pointerEvents, computedCursor: bc.cursor,
          computedDisplay: bc.display, computedVisibility: bc.visibility, computedOpacity: bc.opacity,
          rect: { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) },
          buttonType: btn.getAttribute('type')
        };

        var chain = [];
        var cur = btn;
        while (cur && cur !== overlayContainer) {
          chain.push({
            tag: cur.tagName, className: (cur.className || '').toString().substring(0, 80),
            pointerEvents: window.getComputedStyle(cur).pointerEvents
          });
          cur = cur.parentElement;
        }
        result.pointerEventsChain = chain;

        var cx = br.x + br.width / 2;
        var cy = br.y + br.height / 2;
        var atPoint = document.elementFromPoint(cx, cy);
        result.elementFromPoint = atPoint ? {
          tag: atPoint.tagName, id: atPoint.id || '(none)',
          className: (atPoint.className || '').toString().substring(0, 120),
          computedPE: window.getComputedStyle(atPoint).pointerEvents
        } : null;
        result.elementFromPointCoords = { x: Math.round(cx), y: Math.round(cy) };
      }

      var backdrop = overlayContainer.querySelector('.bpmn-element-overlay-backdrop');
      if (backdrop) {
        var bdc = window.getComputedStyle(backdrop);
        var bdr = backdrop.getBoundingClientRect();
        result.backdrop = { computedPE: bdc.pointerEvents,
          rect: { x: Math.round(bdr.x), y: Math.round(bdr.y), w: Math.round(bdr.width), h: Math.round(bdr.height) } };
      }

      var below = overlayContainer.querySelector('.bpmn-element-overlay');
      if (below) {
        var blc = window.getComputedStyle(below);
        var blr = below.getBoundingClientRect();
        result.belowOverlay = { computedPE: blc.pointerEvents,
          rect: { x: Math.round(blr.x), y: Math.round(blr.y), w: Math.round(blr.width), h: Math.round(blr.height) } };
      }

      return result;
    })();`)) as Record<string, unknown>;

    console.log('\n========== DRILLDOWN DIAGNOSTIC ==========');
    console.log(JSON.stringify(diagnostic, null, 2));
    console.log('==========================================\n');

    assert.ok(diagnostic.drilldownButtonExists, 'Drilldown button must exist');
  });

  it('bpmn/drilldown/overlay-click: should drill into subprocess by clicking the overlay button', async () => {
    await studioAgent.clickDrilldownOverlay('SubProcess_Collapsed');

    const isInSubprocess = await studioAgent.isInsideSubprocessPlane();
    assert.strictEqual(isInSubprocess, true, 'Should be inside subprocess plane after overlay click');

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  // ─── Property panes ─────────────────────────────────────────────────

  it('bpmn/drilldown/panes: should hide Definition pane when drilled into subprocess', async () => {
    await studioAgent.assertVisible(DEFINITION_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.drillDownIntoSubprocess('SubProcess_Collapsed');

    await studioAgent.assertNotVisible(DEFINITION_PANE);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/drilldown/panes: should show SubprocessContext pane when drilled in with no selection', async () => {
    await studioAgent.drillDownIntoSubprocess('SubProcess_Collapsed');

    await studioAgent.assertVisible(SUBPROCESS_CONTEXT_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });

  it('bpmn/drilldown/panes: should restore Definition pane after drilling back up', async () => {
    await studioAgent.drillDownIntoSubprocess('SubProcess_Collapsed');
    await studioAgent.assertNotVisible(DEFINITION_PANE);

    await studioAgent.drillUpFromSubprocess();

    await studioAgent.assertVisible(DEFINITION_PANE, ASSERT_VISIBLE_TIMEOUT);

    await studioAgent.assertNoErrorsPresentAndIdle();
  });
});
