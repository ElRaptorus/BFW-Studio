const events = [];
let overlaysSet = false;
let lastSelectedElement = null;
let clickCount = 0;
let factoryDisposable = null;
let factoryCallCount = 0;
let lastViewChanged = null;
let lastHoveredElement = null;
let lastDoubleClickedElement = null;
let lastContextMenuElement = null;

exports.activate = async (api) => {
  async function resolveUri(uri) {
    if (uri != null) return uri;
    const focused = await api.editors.getFocusedDocumentUri();
    if (focused == null) throw new Error('No DMN document is currently focused');
    return focused;
  }

  // Auto-render overlays via the overlay factory — no command needed.
  // Demonstrates multiple overlay styles, tooltips, and click interactivity.
  factoryDisposable = await api.dmn.registerOverlayFactory(
    (context) => {
      factoryCallCount++;
      const autoOverlays = [];

      for (const element of context.elements) {
        if (element.type === 'dmn:InformationRequirement' || element.type === 'dmn:KnowledgeRequirement') continue;

        // Warning badge on Decisions with more than one requirement
        if (element.type === 'dmn:Decision' && element.incoming.length > 1) {
          autoOverlays.push({
            elementId: element.id,
            position: 'top-right',
            type: 'badge',
            text: String(element.incoming.length),
            style: 'warning',
            tooltip: `⚠ ${element.incoming.length} incoming requirements`,
            onClickCommand: 'plugin.dmn-overlay-demo.handleOverlayClick',
            onClickCommandArgs: [`multi-requirement:${element.id}`],
          });
        }

        // Info icon on Input Data elements
        if (element.type === 'dmn:InputData') {
          autoOverlays.push({
            elementId: element.id,
            position: 'bottom-right',
            type: 'icon',
            icon: 'ph ph-database',
            style: 'info',
            tooltip: `ℹ Input Data — provided externally`,
          });
        }

        // Status pill: outgoing requirement counter on Business Knowledge Models
        if (element.type === 'dmn:BusinessKnowledgeModel') {
          autoOverlays.push({
            elementId: element.id,
            position: 'below',
            type: 'status',
            icon: 'ph ph-function',
            text: String(element.outgoing.length),
            tooltip: `${element.outgoing.length} outgoing knowledge requirement(s)`,
          });
        }

        // Success badge on Decisions with no outgoing requirements (leaf results)
        if (element.type === 'dmn:Decision' && element.outgoing.length === 0) {
          autoOverlays.push({
            elementId: element.id,
            position: 'top-left',
            type: 'badge',
            text: '✓',
            style: 'success',
            tooltip: `✓ Final decision — not required by any other decision`,
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
        await api.dmn.setOverlays(resolvedUri, [
          {
            elementId: 'Decision_Discount',
            position: 'top-left',
            type: 'badge',
            text: '!',
            style: 'warning',
            tooltip: '⚠ Warning: This decision needs attention — click for details',
            onClickCommand: 'handleOverlayClick',
            onClickCommandArgs: ['multi-requirement:Decision_Discount'],
          },
          {
            elementId: 'Decision_Discount',
            position: 'top-right',
            type: 'badge',
            text: '3',
            style: 'error',
            tooltip: '✗ 3 validation errors found',
          },
          {
            elementId: 'Decision_Discount',
            position: 'bottom-left',
            type: 'badge',
            text: 'OK',
            style: 'success',
            tooltip: '✓ All checks passed',
          },
          {
            elementId: 'Decision_Discount',
            position: 'bottom-right',
            type: 'icon',
            icon: 'ph ph-info',
            style: 'info',
            tooltip: 'ℹ Click for element details',
            onClickCommand: 'handleOverlayClick',
            onClickCommandArgs: ['info-click:Decision_Discount'],
          },
        ]);
        overlaysSet = true;
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Set Overlays' },
  );

  await api.commands.register(
    'setInteractiveOverlay',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.dmn.setOverlays(resolvedUri, [
          {
            elementId: 'Decision_Discount',
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
    { visibleInSearch: true, description: 'DMN Overlay Demo: Set Interactive Overlay' },
  );

  await api.commands.register(
    'handleOverlayClick',
    async (arg) => {
      clickCount++;
      events.push(`click:${arg}`);

      const [action, elementId] = (arg ?? '').split(':');
      let message = `Overlay clicked: ${arg}`;

      if (action === 'multi-requirement') {
        message = `⚠ Element "${elementId}" has multiple incoming requirements.`;
      } else if (action === 'info-click') {
        message = `ℹ Element "${elementId}" — use the Inspector pane to view and edit properties.`;
      } else if (action === 'test-arg') {
        message = `⚡ Interactive overlay action triggered successfully (arg: ${arg}).`;
      }

      await api.notifications.open({
        type: action === 'multi-requirement' ? 'warning' : 'info',
        content: message,
      });

      return `clicked:${arg}`;
    },
    { visibleInSearch: false, description: 'DMN Overlay Demo: Handle Click' },
  );

  await api.commands.register(
    'clearOverlays',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.dmn.clearOverlays(resolvedUri);
        overlaysSet = false;
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Clear Overlays' },
  );

  await api.commands.register(
    'clearOverlaysByElement',
    async (uri, elementId) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.dmn.clearOverlays(resolvedUri, { elementId });
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Clear Overlays for Element' },
  );

  await api.commands.register(
    'subscribeSelection',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.dmn.onElementSelected(resolvedUri, (event) => {
          lastSelectedElement = event;
          events.push(`selected:${event.elementId}`);
        });
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Subscribe Selection' },
  );

  await api.commands.register(
    'subscribeHover',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.dmn.onElementHover(resolvedUri, (event) => {
          lastHoveredElement = event;
          events.push(`hover:${event.elementId}`);
        });
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Subscribe Hover' },
  );

  await api.commands.register(
    'subscribeDoubleClick',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.dmn.onElementDoubleClick(resolvedUri, (event) => {
          lastDoubleClickedElement = event;
          events.push(`dblclick:${event.elementId}`);
        });
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Subscribe Double Click' },
  );

  await api.commands.register(
    'subscribeContextMenu',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.dmn.onElementContextMenu(resolvedUri, (event) => {
          lastContextMenuElement = event;
          events.push(`contextmenu:${event.elementId}`);
        });
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Subscribe Context Menu' },
  );

  await api.commands.register(
    'subscribeViewChanged',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        await api.dmn.onViewChanged(resolvedUri, (event) => {
          lastViewChanged = event;
          events.push(`view-changed:${event.viewType}`);
        });
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Subscribe View Changed' },
  );

  await api.commands.register(
    'getActiveView',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        return await api.dmn.getActiveView(resolvedUri);
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Get Active View' },
  );

  await api.commands.register(
    'getElements',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        const elements = await api.dmn.getElements(resolvedUri);
        return elements;
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Get Elements' },
  );

  await api.commands.register(
    'getElement',
    async (uri, elementId) => {
      try {
        const resolvedUri = await resolveUri(uri);
        const element = await api.dmn.getElement(resolvedUri, elementId);
        return element;
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Get Element Detail' },
  );

  await api.commands.register(
    'getXml',
    async (uri) => {
      try {
        const resolvedUri = await resolveUri(uri);
        const xml = await api.dmn.getXml(resolvedUri);
        return typeof xml === 'string' ? 'ok' : 'not a string';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Get XML' },
  );

  await api.commands.register('getEvents', () => [...events], {
    visibleInSearch: true,
    description: 'DMN Overlay Demo: Get Collected Events',
  });

  await api.commands.register('getLastSelected', () => lastSelectedElement, {
    visibleInSearch: true,
    description: 'DMN Overlay Demo: Get Last Selected',
  });

  await api.commands.register('getLastViewChanged', () => lastViewChanged, {
    visibleInSearch: true,
    description: 'DMN Overlay Demo: Get Last View Changed',
  });

  await api.commands.register('getLastHovered', () => lastHoveredElement, {
    visibleInSearch: true,
    description: 'DMN Overlay Demo: Get Last Hovered',
  });

  await api.commands.register('getLastDoubleClicked', () => lastDoubleClickedElement, {
    visibleInSearch: true,
    description: 'DMN Overlay Demo: Get Last Double Clicked',
  });

  await api.commands.register('getLastContextMenu', () => lastContextMenuElement, {
    visibleInSearch: true,
    description: 'DMN Overlay Demo: Get Last Context Menu',
  });

  await api.commands.register('getClickCount', () => clickCount, {
    visibleInSearch: true,
    description: 'DMN Overlay Demo: Get Click Count',
  });

  await api.commands.register('isOverlaysSet', () => overlaysSet, {
    visibleInSearch: true,
    description: 'DMN Overlay Demo: Is Overlays Set',
  });

  await api.commands.register('getFactoryCallCount', () => factoryCallCount, {
    visibleInSearch: true,
    description: 'DMN Overlay Demo: Get Factory Call Count',
  });

  await api.commands.register(
    'setOverlaysOnMissingUri',
    async () => {
      try {
        await api.dmn.setOverlays('file:///nonexistent.dmn', [
          { elementId: 'X', position: 'top-left', type: 'badge', text: '!', style: 'info' },
        ]);
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Set Overlays Missing URI' },
  );

  await api.commands.register(
    'subscribeOnMissingUri',
    async () => {
      try {
        await api.dmn.onElementSelected('file:///nonexistent.dmn', () => {});
        return 'ok';
      } catch (err) {
        return `error: ${err.message}`;
      }
    },
    { visibleInSearch: true, description: 'DMN Overlay Demo: Subscribe Missing URI' },
  );
};

exports.deactivate = () => {
  events.length = 0;
  lastSelectedElement = null;
  lastViewChanged = null;
  lastHoveredElement = null;
  lastDoubleClickedElement = null;
  lastContextMenuElement = null;
  overlaysSet = false;
  clickCount = 0;
  factoryCallCount = 0;
  if (factoryDisposable != null) {
    factoryDisposable.dispose();
    factoryDisposable = null;
  }
};
