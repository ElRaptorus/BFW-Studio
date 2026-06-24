/**
 * bpmn-palette-demo — fixture plugin demonstrating:
 * 1. Manifest-declared palette entry (static, always visible)
 * 2. Manifest-declared context pad entry (static elementTypes filter)
 * 3. Runtime context pad entry (no filter — shows on all elements)
 * 4. Dynamic runtime context pad entry (elementIds allowlist pattern)
 */

function activate(api) {
  api.commands.register(
    'runAnalysis',
    () => {
      api.notifications.open({ type: 'info', content: 'Running BPMN analysis...' });
    },
    { visibleInSearch: true, description: 'BPMN Palette Demo: Run Analysis' },
  );

  api.commands.register(
    'inspectElement',
    (context) => {
      const info = context?.[0] ?? context;
      api.notifications.open({
        type: 'info',
        content: `Inspecting: ${info?.elementId ?? 'unknown'} (${info?.elementType ?? 'unknown'})`,
      });
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Inspect Element' },
  );

  api.commands.register(
    'flagElement',
    (context) => {
      const info = context?.[0] ?? context;
      api.notifications.open({
        type: 'warning',
        content: `Flagged: ${info?.elementId ?? 'unknown'}`,
      });
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Flag Element' },
  );

  api.commands.register(
    'viewConnections',
    (context) => {
      const info = context?.[0] ?? context;
      api.notifications.open({
        type: 'info',
        content: `Viewing connections for: ${info?.elementId ?? 'unknown'}`,
      });
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: View Connections' },
  );

  // Runtime context pad entry: no filter — shows on every element
  api.bpmn.registerContextPadEntry({
    id: 'flag-element',
    icon: 'ph-light ph-flag',
    title: 'Flag Element',
    command: 'flagElement',
  });

  // Dynamic runtime context pad entry: starts hidden (empty allowlist),
  // populated dynamically via updateContextPadEntry when elements are known.
  // Demonstrates the pre-evaluated elementIds allowlist pattern.
  api.bpmn.registerContextPadEntry({
    id: 'view-connections',
    icon: 'ph-light ph-git-branch',
    title: 'View Connections (2+ outgoing)',
    command: 'viewConnections',
    elementTypes: ['bpmn:ExclusiveGateway', 'bpmn:ParallelGateway', 'bpmn:InclusiveGateway', 'bpmn:Task'],
    elementIds: [],
  });

  // Expose a helper command so integration tests can trigger the dynamic update:
  // The test calls this command with the elements array to populate the allowlist.
  api.commands.register(
    'updateViewConnectionsFilter',
    (args) => {
      const elements = args?.[0] ?? args;
      if (!Array.isArray(elements)) return;
      const qualifyingIds = elements
        .filter((element) => element.outgoing != null && element.outgoing.length >= 2)
        .map((element) => element.id);
      api.bpmn.updateContextPadEntry('view-connections', { elementIds: qualifyingIds });
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Update View Connections Filter' },
  );

  // ── Test utility commands ────────────────────────────────────────────
  // These expose internal state for integration test assertions.

  api.commands.register('test.isActivated', () => true, {
    visibleInSearch: false,
    description: 'BPMN Palette Demo: Check Activated',
  });

  api.commands.register(
    'test.tryUnregisterContextPadEntry',
    async (args) => {
      const entryId = args?.[0] ?? args;
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
    async (args) => {
      const entryId = args?.[0] ?? args;
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
    async (args) => {
      const [entryId, update] = args ?? [];
      try {
        await api.bpmn.updateContextPadEntry(entryId, update);
        return 'ok';
      } catch (err) {
        return `error:${err.message}`;
      }
    },
    { visibleInSearch: false, description: 'BPMN Palette Demo: Test Update Context Pad' },
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
