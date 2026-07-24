/**
 * dmn-palette-demo — fixture plugin demonstrating:
 * 1. Manifest-declared palette entry (static, always visible)
 * 2. Manifest-declared context pad entry (static elementTypes filter)
 * 3. Runtime context pad entries with dynamic elementIds allowlists
 * 4. Modeling API usage: createElement, appendElement, updateProperties, removeElement, createConnection, moveElement
 * 5. Coherent Flag/Unflag feature: context pad ↔ overlays ↔ internal state
 */

let currentUri = null;
let selectedElementId = null;

// Per-document flagged elements: Map<uri, Set<elementId>>
const flaggedElements = new Map();

function getFlaggedSet(uri) {
  if (!flaggedElements.has(uri)) {
    flaggedElements.set(uri, new Set());
  }
  return flaggedElements.get(uri);
}

function buildFlagOverlays(uri) {
  const flagged = getFlaggedSet(uri);
  const overlays = [];
  for (const elementId of flagged) {
    overlays.push({
      elementId,
      position: 'top-right',
      type: 'status',
      icon: 'ph-light ph-flag',
      text: '',
      tooltip: 'This element is flagged!',
      style: 'warning',
    });
  }
  return overlays;
}

function activate(api) {
  // ── Manifest command handlers ──────────────────────────────────────────────

  api.commands.register(
    'runAnalysis',
    async () => {
      if (currentUri == null) {
        api.notifications.open({ type: 'warning', content: 'No DMN document open.' });
        return;
      }
      const elements = await api.dmn.getElements(currentUri);
      const decisions = elements.filter((el) => el.type === 'dmn:Decision');
      const inputs = elements.filter((el) => el.type === 'dmn:InputData');
      const bkms = elements.filter((el) => el.type === 'dmn:BusinessKnowledgeModel');
      api.notifications.open({
        type: 'info',
        content: `Analysis: ${decisions.length} decisions, ${inputs.length} inputs, ${bkms.length} BKMs (${elements.length} total)`,
      });
    },
    { visibleInSearch: true, description: 'DMN Palette Demo: Run Analysis' },
  );

  api.commands.register(
    'inspectElement',
    async (info) => {
      if (info?.elementId == null || currentUri == null) {
        api.notifications.open({ type: 'warning', content: 'No element selected.' });
        return;
      }
      const detail = await api.dmn.getElement(currentUri, info.elementId);
      if (detail == null) {
        api.notifications.open({ type: 'error', content: `Element ${info.elementId} not found.` });
        return;
      }
      const props = Object.entries(detail.properties || {})
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      api.notifications.open({
        type: 'info',
        content: `[${detail.type}] ${detail.name || detail.id} — ${props || 'no properties'}`,
      });
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Inspect Element' },
  );

  // ── Modeling API demonstrations ────────────────────────────────────────────

  api.commands.register(
    'insertDecisionTemplate',
    async () => {
      if (currentUri == null || selectedElementId == null) {
        api.notifications.open({
          type: 'warning',
          content: 'Select an element first, then insert a decision after it.',
        });
        return;
      }
      try {
        const result = await api.dmn.modeling.appendElement(currentUri, selectedElementId, {
          type: 'dmn:Decision',
          name: 'New Decision',
        });
        api.notifications.open({
          type: 'success',
          content: `Created Decision '${result.elementId}' connected to ${selectedElementId}`,
        });
      } catch (err) {
        api.notifications.open({ type: 'error', content: `Insert failed: ${err.message}` });
      }
    },
    { visibleInSearch: true, description: 'DMN Palette Demo: Insert Decision Template' },
  );

  api.commands.register(
    'renameElement',
    async (info) => {
      if (info?.elementId == null || currentUri == null) return;
      try {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await api.dmn.modeling.updateProperties(currentUri, info.elementId, {
          name: `Renamed at ${timestamp}`,
        });
        api.notifications.open({
          type: 'success',
          content: `Renamed '${info.elementId}' — undo with Ctrl+Z`,
        });
      } catch (err) {
        api.notifications.open({ type: 'error', content: `Rename failed: ${err.message}` });
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Rename Element' },
  );

  api.commands.register(
    'deleteElement',
    async (info) => {
      if (info?.elementId == null || currentUri == null) return;
      try {
        await api.dmn.modeling.removeElement(currentUri, info.elementId);
        api.notifications.open({
          type: 'info',
          content: `Deleted '${info.elementId}' — undo with Ctrl+Z`,
        });
      } catch (err) {
        api.notifications.open({ type: 'error', content: `Delete failed: ${err.message}` });
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Delete Element' },
  );

  api.commands.register(
    'nudgeRight',
    async (info) => {
      if (info?.elementId == null || currentUri == null) return;
      try {
        await api.dmn.modeling.moveElement(currentUri, info.elementId, { x: 50, y: 0 });
      } catch (err) {
        api.notifications.open({ type: 'error', content: `Move failed: ${err.message}` });
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Nudge Right' },
  );

  // ── Flag / Unflag feature ─────────────────────────────────────────────────
  // Demonstrates: internal state + overlay factory + requestOverlayRefresh

  api.commands.register(
    'toggleFlag',
    async (info) => {
      if (info?.elementId == null || currentUri == null) return;
      const flagged = getFlaggedSet(currentUri);

      if (flagged.has(info.elementId)) {
        flagged.delete(info.elementId);
      } else {
        flagged.add(info.elementId);
      }

      await api.dmn.requestOverlayRefresh();
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Toggle Flag' },
  );

  api.commands.register(
    'viewRequirements',
    (info) => {
      api.notifications.open({
        type: 'info',
        content: `Viewing requirements for: ${info?.elementId ?? 'unknown'}`,
      });
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: View Requirements' },
  );

  // ── Runtime context pad entry: View Requirements (dynamic elementIds) ──────
  // This entry is also declared in the manifest for base visibility, but the
  // runtime call adds elementIds: [] which restricts it to only elements
  // explicitly populated later via updateContextPadEntry.
  api.dmn.registerContextPadEntry({
    id: 'view-requirements',
    icon: 'ph-light ph-git-branch',
    title: 'View Requirements (2+ incoming)',
    command: 'viewRequirements',
    elementTypes: ['dmn:Decision'],
    elementIds: [],
  });

  // ── Overlay factory: produces flag overlays for flagged elements ───────────

  api.dmn.registerOverlayFactory(
    (context) => {
      currentUri = context.uri;
      const flagged = getFlaggedSet(context.uri);
      if (flagged.size === 0) {
        return context.currentOverlays;
      }
      const flagOverlays = buildFlagOverlays(context.uri);
      return [...context.currentOverlays, ...flagOverlays];
    },
    { priority: 1 },
  );

  // ── Track selection for the "Insert Decision Template" palette action ──────

  let selectionSubscribed = false;
  const trySubscribeSelection = async () => {
    if (currentUri != null && !selectionSubscribed) {
      selectionSubscribed = true;
      await api.dmn.onElementSelected(currentUri, (event) => {
        selectedElementId = event.elementId || null;
      });
    }
  };

  const interval = setInterval(async () => {
    await trySubscribeSelection();
    if (selectionSubscribed) clearInterval(interval);
  }, 2000);

  // Expose test command to trigger the dynamic view-requirements filter update
  api.commands.register(
    'updateViewRequirementsFilter',
    (elements) => {
      if (!Array.isArray(elements)) return;
      const qualifyingIds = elements
        .filter((element) => element.incoming != null && element.incoming.length >= 2)
        .map((element) => element.id);
      api.dmn.updateContextPadEntry('view-requirements', { elementIds: qualifyingIds });
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Update View Requirements Filter' },
  );

  // ── Test utility commands ────────────────────────────────────────────
  // NOTE: Bifrost's CommandManager uses .apply(null, args), so each array
  // element becomes a separate parameter to the handler function.
  api.commands.register('test.isActivated', () => true, {
    visibleInSearch: false,
    description: 'DMN Palette Demo: Check Activated',
  });

  api.commands.register(
    'test.tryUnregisterContextPadEntry',
    async (entryId) => {
      try {
        await api.dmn.unregisterContextPadEntry(entryId);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test Unregister Context Pad' },
  );

  api.commands.register(
    'test.tryUnregisterPaletteEntry',
    async (entryId) => {
      try {
        await api.dmn.unregisterPaletteEntry(entryId);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test Unregister Palette' },
  );

  api.commands.register(
    'test.updateContextPadEntry',
    async (entryId, update) => {
      try {
        await api.dmn.updateContextPadEntry(entryId, update);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test Update Context Pad' },
  );

  // Modeling test commands (for integration tests)
  api.commands.register(
    'test.modeling.updateProperties',
    async (uri, elementId, properties) => {
      try {
        await api.dmn.modeling.updateProperties(uri, elementId, properties);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test updateProperties' },
  );

  api.commands.register(
    'test.modeling.removeElement',
    async (uri, elementId) => {
      try {
        await api.dmn.modeling.removeElement(uri, elementId);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test removeElement' },
  );

  api.commands.register(
    'test.modeling.createElement',
    async (uri, descriptor) => {
      try {
        const result = await api.dmn.modeling.createElement(uri, descriptor);
        return result;
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test createElement' },
  );

  api.commands.register(
    'test.modeling.appendElement',
    async (uri, sourceId, descriptor) => {
      try {
        const result = await api.dmn.modeling.appendElement(uri, sourceId, descriptor);
        return result;
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test appendElement' },
  );

  api.commands.register(
    'test.modeling.createConnection',
    async (uri, sourceId, targetId, type) => {
      try {
        const result = await api.dmn.modeling.createConnection(uri, sourceId, targetId, type);
        return result;
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test createConnection' },
  );

  api.commands.register(
    'test.modeling.moveElement',
    async (uri, elementId, delta) => {
      try {
        await api.dmn.modeling.moveElement(uri, elementId, delta);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test moveElement' },
  );

  api.commands.register(
    'test.getElement',
    async (uri, elementId) => {
      try {
        return await api.dmn.getElement(uri, elementId);
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test getElement' },
  );

  api.commands.register(
    'test.getElements',
    async (uri) => {
      try {
        return await api.dmn.getElements(uri);
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'DMN Palette Demo: Test getElements' },
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
