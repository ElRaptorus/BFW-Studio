/**
 * bpmn-palette-demo — fixture plugin demonstrating:
 * 1. Manifest-declared palette entry (static, always visible)
 * 2. Manifest-declared context pad entry (static elementTypes filter)
 * 3. Runtime context pad entries with dynamic elementIds allowlists
 * 4. Modeling API usage: append, rename, remove, connect, move
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
        api.notifications.open({ type: 'warning', content: 'No BPMN document open.' });
        return;
      }
      const elements = await api.bpmn.getElements(currentUri);
      const tasks = elements.filter((el) => el.type.includes('Task'));
      const gateways = elements.filter((el) => el.type.includes('Gateway'));
      const events = elements.filter((el) => el.type.includes('Event'));
      api.notifications.open({
        type: 'info',
        content: `Analysis: ${tasks.length} tasks, ${gateways.length} gateways, ${events.length} events (${elements.length} total)`,
      });
    },
    { visibleInSearch: true, description: 'BPMN Palette Demo: Run Analysis' },
  );

  api.commands.register(
    'inspectElement',
    async (info) => {
      if (info?.elementId == null || currentUri == null) {
        api.notifications.open({ type: 'warning', content: 'No element selected.' });
        return;
      }
      const detail = await api.bpmn.getElement(currentUri, info.elementId);
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
    { visibleInSearch: false, description: 'BPMN Palette Demo: Inspect Element' },
  );

  // ── Modeling API demonstrations ────────────────────────────────────────────

  api.commands.register(
    'insertTaskTemplate',
    async () => {
      if (currentUri == null || selectedElementId == null) {
        api.notifications.open({ type: 'warning', content: 'Select an element first, then insert a task after it.' });
        return;
      }
      try {
        const result = await api.bpmn.modeling.appendElement(currentUri, selectedElementId, {
          type: 'bpmn:ServiceTask',
          name: 'New Service Task',
        });
        api.notifications.open({
          type: 'success',
          content: `Created Service Task '${result.elementId}' connected to ${selectedElementId}`,
        });
      } catch (err) {
        api.notifications.open({ type: 'error', content: `Insert failed: ${err.message}` });
      }
    },
    { visibleInSearch: true, description: 'BPMN Palette Demo: Insert Task Template' },
  );

  api.commands.register(
    'renameElement',
    async (info) => {
      if (info?.elementId == null || currentUri == null) return;
      try {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await api.bpmn.modeling.updateProperties(currentUri, info.elementId, {
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
    { visibleInSearch: false, description: 'BPMN Palette Demo: Rename Element' },
  );

  api.commands.register(
    'deleteElement',
    async (info) => {
      if (info?.elementId == null || currentUri == null) return;
      try {
        await api.bpmn.modeling.removeElement(currentUri, info.elementId);
        api.notifications.open({
          type: 'info',
          content: `Deleted '${info.elementId}' — undo with Ctrl+Z`,
        });
      } catch (err) {
        api.notifications.open({ type: 'error', content: `Delete failed: ${err.message}` });
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Delete Element' },
  );

  api.commands.register(
    'nudgeRight',
    async (info) => {
      if (info?.elementId == null || currentUri == null) return;
      try {
        await api.bpmn.modeling.moveElement(currentUri, info.elementId, { x: 50, y: 0 });
      } catch (err) {
        api.notifications.open({ type: 'error', content: `Move failed: ${err.message}` });
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Nudge Right' },
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

      await api.bpmn.requestOverlayRefresh();
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Toggle Flag' },
  );

  api.commands.register(
    'viewConnections',
    (info) => {
      api.notifications.open({
        type: 'info',
        content: `Viewing connections for: ${info?.elementId ?? 'unknown'}`,
      });
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: View Connections' },
  );

  // ── Runtime context pad entry: View Connections (dynamic elementIds) ───────
  // This entry is also declared in the manifest for base visibility, but the
  // runtime call adds elementIds: [] which restricts it to only elements
  // explicitly populated later via updateContextPadEntry.
  api.bpmn.registerContextPadEntry({
    id: 'view-connections',
    icon: 'ph-light ph-git-branch',
    title: 'View Connections (2+ outgoing)',
    command: 'viewConnections',
    elementTypes: ['bpmn:ExclusiveGateway', 'bpmn:ParallelGateway', 'bpmn:InclusiveGateway', 'bpmn:Task'],
    elementIds: [],
  });

  // ── Overlay factory: produces flag overlays for flagged elements ───────────

  api.bpmn.registerOverlayFactory(
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

  // ── Track selection for the "Insert Task Template" palette action ──────────

  let selectionSubscribed = false;
  const trySubscribeSelection = async () => {
    if (currentUri != null && !selectionSubscribed) {
      selectionSubscribed = true;
      await api.bpmn.onElementSelected(currentUri, (event) => {
        selectedElementId = event.elementId || null;
      });
    }
  };

  const interval = setInterval(async () => {
    await trySubscribeSelection();
    if (selectionSubscribed) clearInterval(interval);
  }, 2000);

  // Expose test command to trigger the dynamic view-connections filter update
  api.commands.register(
    'updateViewConnectionsFilter',
    (elements) => {
      if (!Array.isArray(elements)) return;
      const qualifyingIds = elements
        .filter((element) => element.outgoing != null && element.outgoing.length >= 2)
        .map((element) => element.id);
      api.bpmn.updateContextPadEntry('view-connections', { elementIds: qualifyingIds });
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Update View Connections Filter' },
  );

  // ── Test utility commands ────────────────────────────────────────────
  // NOTE: Bifrost's CommandManager uses .apply(null, args), so each array
  // element becomes a separate parameter to the handler function.
  api.commands.register('test.isActivated', () => true, {
    visibleInSearch: false,
    description: 'BPMN Palette Demo: Check Activated',
  });

  api.commands.register(
    'test.tryUnregisterContextPadEntry',
    async (entryId) => {
      try {
        await api.bpmn.unregisterContextPadEntry(entryId);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Test Unregister Context Pad' },
  );

  api.commands.register(
    'test.tryUnregisterPaletteEntry',
    async (entryId) => {
      try {
        await api.bpmn.unregisterPaletteEntry(entryId);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Test Unregister Palette' },
  );

  api.commands.register(
    'test.updateContextPadEntry',
    async (entryId, update) => {
      try {
        await api.bpmn.updateContextPadEntry(entryId, update);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Test Update Context Pad' },
  );

  // Modeling test commands (for integration tests)
  api.commands.register(
    'test.modeling.updateProperties',
    async (uri, elementId, properties) => {
      try {
        await api.bpmn.modeling.updateProperties(uri, elementId, properties);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Test updateProperties' },
  );

  api.commands.register(
    'test.modeling.removeElement',
    async (uri, elementId) => {
      try {
        await api.bpmn.modeling.removeElement(uri, elementId);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Test removeElement' },
  );

  api.commands.register(
    'test.modeling.appendElement',
    async (uri, sourceId, descriptor) => {
      try {
        const result = await api.bpmn.modeling.appendElement(uri, sourceId, descriptor);
        return result;
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Test appendElement' },
  );

  api.commands.register(
    'test.modeling.createConnection',
    async (uri, sourceId, targetId, type) => {
      try {
        const result = await api.bpmn.modeling.createConnection(uri, sourceId, targetId, type);
        return result;
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Test createConnection' },
  );

  api.commands.register(
    'test.modeling.moveElement',
    async (uri, elementId, delta) => {
      try {
        await api.bpmn.modeling.moveElement(uri, elementId, delta);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Test moveElement' },
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
