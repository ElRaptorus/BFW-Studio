const events = [];
let overlaysSet = false;
let lastSelectedElement = null;
let clickCount = 0;
let factoryDisposable = null;
let factoryCallCount = 0;

exports.activate = async (api) => {
  async function resolveUri(uri) {
    if (uri != null) return uri;
    const focused = await api.editors.getFocusedDocumentUri();
    if (focused == null) throw new Error('No BPMN document is currently focused');
    return focused;
  }

  // Auto-render overlays via the overlay factory — no command needed.
  // Demonstrates multiple overlay styles, tooltips, and click interactivity.
  factoryDisposable = await api.bpmn.registerOverlayFactory(
    (context) => {
      factoryCallCount++;
      const autoOverlays = [];

      for (const element of context.elements) {
        if (element.type.includes('SequenceFlow')) continue;

        // Warning badge on elements with >1 outgoing flow (except gateways)
        if (element.outgoing.length > 1 && !element.type.includes('Gateway')) {
          autoOverlays.push({
            elementId: element.id,
            position: 'top-right',
            type: 'badge',
            text: String(element.outgoing.length),
            style: 'warning',
            tooltip: `⚠ ${element.outgoing.length} outgoing flows without gateway — consider adding a split gateway`,
            onClickCommand: 'plugin.bpmn-overlay-demo.handleOverlayClick',
            onClickCommandArgs: [`split-warning:${element.id}`],
          });
        }

        // Error badge on elements with no outgoing and no incoming (orphaned)
        if (
          element.outgoing.length === 0 &&
          element.incoming.length === 0 &&
          !element.type.includes('StartEvent') &&
          !element.type.includes('EndEvent') &&
          !element.type.includes('BoundaryEvent') &&
          !element.type.includes('DataObject')
        ) {
          autoOverlays.push({
            elementId: element.id,
            position: 'top-left',
            type: 'badge',
            text: '⊘',
            style: 'error',
            tooltip: `✗ Orphaned element — not connected to any flow`,
          });
        }

        // Info icon on service tasks
        if (element.type.includes('ServiceTask')) {
          autoOverlays.push({
            elementId: element.id,
            position: 'bottom-right',
            type: 'icon',
            icon: 'ph ph-plugs-connected',
            style: 'info',
            tooltip: `ℹ Service Task — requires external handler`,
          });
        }

        // Success badge on end events with incoming flows
        if (element.type.includes('EndEvent') && element.incoming.length > 0) {
          autoOverlays.push({
            elementId: element.id,
            position: 'top-left',
            type: 'badge',
            text: '✓',
            style: 'success',
            tooltip: `✓ End event with ${element.incoming.length} incoming flow(s)`,
          });
        }
      }

      return [...context.currentOverlays, ...autoOverlays];
    },
    { priority: 150 },
  );

  await api.commands.register(
    'setOverlays',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.bpmn.setOverlays(resolvedUri, [
          {
            elementId: 'StartEvent_1',
            position: 'top-left',
            type: 'badge',
            text: '!',
            style: 'warning',
            tooltip: '⚠ Warning: This start event needs attention — click for details',
            onClickCommand: 'handleOverlayClick',
            onClickCommandArgs: ['split-warning:StartEvent_1'],
          },
          {
            elementId: 'StartEvent_1',
            position: 'top-right',
            type: 'badge',
            text: '3',
            style: 'error',
            tooltip: '✗ 3 validation errors found',
          },
          {
            elementId: 'StartEvent_1',
            position: 'bottom-left',
            type: 'badge',
            text: 'OK',
            style: 'success',
            tooltip: '✓ All checks passed',
          },
          {
            elementId: 'StartEvent_1',
            position: 'bottom-right',
            type: 'icon',
            icon: 'ph ph-info',
            style: 'info',
            tooltip: 'ℹ Click for element details',
            onClickCommand: 'handleOverlayClick',
            onClickCommandArgs: ['info-click:StartEvent_1'],
          },
        ]);
        overlaysSet = true;
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'BPMN Overlay Demo: Set Overlays' },
  );

  await api.commands.register(
    'setInteractiveOverlay',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.bpmn.setOverlays(resolvedUri, [
          {
            elementId: 'StartEvent_1',
            position: 'bottom-left',
            type: 'badge',
            text: '⚡ Action',
            style: 'info',
            tooltip: '⚡ Click to trigger an action on this element',
            onClickCommand: 'handleOverlayClick',
            onClickCommandArgs: ['test-arg'],
          },
        ]);
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'BPMN Overlay Demo: Set Interactive Overlay' },
  );

  await api.commands.register(
    'handleOverlayClick',
    async (arg) => {
      clickCount++;
      events.push(`click:${arg}`);

      const [action, elementId] = (arg ?? '').split(':');
      let message = `Overlay clicked: ${arg}`;

      if (action === 'split-warning') {
        message = `⚠ Element "${elementId}" has multiple outgoing flows without a gateway. Consider adding an Exclusive or Inclusive Gateway to control the flow.`;
      } else if (action === 'info-click') {
        message = `ℹ Element "${elementId}" — use the Inspector pane to view and edit properties.`;
      } else if (action === 'test-arg') {
        message = `⚡ Interactive overlay action triggered successfully (arg: ${arg}).`;
      }

      await api.notifications.open({
        type: action === 'split-warning' ? 'warning' : 'info',
        content: message,
      });

      return `clicked:${arg}`;
    },
    { visibleInSearch: false, description: 'BPMN Overlay Demo: Handle Click' },
  );

  await api.commands.register(
    'clearOverlays',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.bpmn.clearOverlays(resolvedUri);
        overlaysSet = false;
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'BPMN Overlay Demo: Clear Overlays' },
  );

  await api.commands.register(
    'clearOverlaysByElement',
    async (uri, elementId) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.bpmn.clearOverlays(resolvedUri, { elementId });
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'BPMN Overlay Demo: Clear Overlays for Element' },
  );

  await api.commands.register(
    'subscribeSelection',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.bpmn.onElementSelected(resolvedUri, (event) => {
          lastSelectedElement = event;
          events.push(`selected:${event.elementId}`);
        });
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'BPMN Overlay Demo: Subscribe Selection' },
  );

  await api.commands.register(
    'getElements',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        const elements = await api.bpmn.getElements(resolvedUri);
        return elements;
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'BPMN Overlay Demo: Get Elements' },
  );

  await api.commands.register(
    'getElement',
    async (uri, elementId) => {
      try {
        const resolvedUri = await resolveUri(uri);
        const element = await api.bpmn.getElement(resolvedUri, elementId);
        return element;
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'BPMN Overlay Demo: Get Element Detail' },
  );

  await api.commands.register(
    'getXml',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        const xml = await api.bpmn.getXml(resolvedUri);
        return typeof xml === 'string' ? 'ok' : 'not a string';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'BPMN Overlay Demo: Get XML' },
  );

  await api.commands.register('getEvents', () => [...events], {
    visibleInSearch: true,
    description: 'BPMN Overlay Demo: Get Collected Events',
  });

  await api.commands.register('getLastSelected', () => lastSelectedElement, {
    visibleInSearch: true,
    description: 'BPMN Overlay Demo: Get Last Selected',
  });

  await api.commands.register('getClickCount', () => clickCount, {
    visibleInSearch: true,
    description: 'BPMN Overlay Demo: Get Click Count',
  });

  await api.commands.register('isOverlaysSet', () => overlaysSet, {
    visibleInSearch: true,
    description: 'BPMN Overlay Demo: Is Overlays Set',
  });

  await api.commands.register('getFactoryCallCount', () => factoryCallCount, {
    visibleInSearch: true,
    description: 'BPMN Overlay Demo: Get Factory Call Count',
  });

  await api.commands.register(
    'setOverlaysOnMissingUri',
    async () => {
      try {
        await api.bpmn.setOverlays('file:///nonexistent.bpmn', [
          { elementId: 'X', position: 'top-left', type: 'badge', text: '!', style: 'info' },
        ]);
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'BPMN Overlay Demo: Set Overlays Missing URI' },
  );

  await api.commands.register(
    'subscribeOnMissingUri',
    async () => {
      try {
        await api.bpmn.onElementSelected('file:///nonexistent.bpmn', () => {});
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'BPMN Overlay Demo: Subscribe Missing URI' },
  );
};

exports.deactivate = () => {
  events.length = 0;
  lastSelectedElement = null;
  overlaysSet = false;
  clickCount = 0;
  factoryCallCount = 0;
  if (factoryDisposable != null) {
    factoryDisposable.dispose();
    factoryDisposable = null;
  }
};
