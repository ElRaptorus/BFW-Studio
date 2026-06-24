/**
 * BPMN Kitchen Sink — exercises all BPMN editor enrichment features simultaneously:
 * - Overlays (badge + icon with onClickCommand)
 * - Overlay factories (action/status types)
 * - Palette entries (manifest-declared)
 * - Context pad entries (manifest-declared + runtime-registered)
 * - Modeling API (updateProperties, appendElement)
 * - Renderer module injection (bidirectional channel communication)
 * - Event subscriptions (onElementSelected)
 */

async function activate(api) {
  let selectedElementId = null;
  let rendererHighlightCount = 0;

  // --- Renderer module channel ---
  await api.bpmn.onRendererModuleMessage((data) => {
    if (data && data.type === 'highlightResult') {
      rendererHighlightCount = data.count;
    }
  });

  // --- Element selection tracking ---
  const focusedUri = await api.editors.getFocusedDocumentUri();
  if (focusedUri != null) {
    await api.bpmn.onElementSelected(focusedUri, (event) => {
      selectedElementId = event.elementId ?? null;
    });
  }

  // --- Overlay factory: badge on all tasks ---
  await api.bpmn.registerOverlayFactory({
    id: 'ks-task-badge',
    type: 'badge',
    position: 'top-right',
    elementTypes: ['bpmn:Task', 'bpmn:ServiceTask', 'bpmn:UserTask'],
    factory: (context) => ({
      text: 'KS',
      tooltip: 'Kitchen Sink badge',
      style: 'info',
    }),
  });

  // --- Overlay factory: interactive icon on gateways ---
  await api.bpmn.registerOverlayFactory({
    id: 'ks-gateway-icon',
    type: 'icon',
    position: 'bottom-left',
    elementTypes: ['bpmn:ExclusiveGateway', 'bpmn:ParallelGateway'],
    factory: (context) => ({
      icon: 'ph-light ph-info',
      tooltip: 'Click for info',
      style: 'neutral',
      onClickCommand: 'ks.overlayClick',
      onClickCommandArgs: [context.element.id],
    }),
  });

  // --- Commands ---

  api.commands.register('ks.highlightAll', async () => {
    const currentUri = await api.editors.getFocusedDocumentUri();
    if (currentUri == null) {
      api.notifications.open({
        type: 'warning',
        content: 'No BPMN document focused.',
        source: 'BPMN Kitchen Sink',
      });
      return;
    }
    const elements = await api.bpmn.getElements(currentUri);
    if (elements == null) {
      return;
    }
    const taskIds = elements
      .filter((el) => el.type.includes('Task'))
      .map((el) => el.id);
    await api.bpmn.postToRendererModule({
      type: 'highlightElements',
      elementIds: taskIds,
    });
    api.notifications.open({
      type: 'info',
      content: `Sent ${taskIds.length} task IDs to renderer for highlighting.`,
      source: 'BPMN Kitchen Sink',
    });
  });

  api.commands.register('ks.renameSelected', async (info) => {
    const targetId = info?.elementId || selectedElementId;
    if (targetId == null) {
      api.notifications.open({
        type: 'warning',
        content: 'No element selected to rename.',
        source: 'BPMN Kitchen Sink',
      });
      return;
    }
    const currentUri = await api.editors.getFocusedDocumentUri();
    if (currentUri == null) {
      return;
    }
    await api.bpmn.modeling.updateProperties(currentUri, targetId, {
      name: `Renamed by KS (${Date.now()})`,
    });
  });

  api.commands.register('ks.appendTask', async () => {
    if (selectedElementId == null) {
      api.notifications.open({
        type: 'warning',
        content: 'Select an element first.',
        source: 'BPMN Kitchen Sink',
      });
      return;
    }
    const currentUri = await api.editors.getFocusedDocumentUri();
    if (currentUri == null) {
      return;
    }
    const result = await api.bpmn.modeling.appendElement(currentUri, selectedElementId, {
      type: 'bpmn:Task',
      name: 'KS Appended',
    });
    api.notifications.open({
      type: 'success',
      content: `Appended task: ${result.elementId}`,
      source: 'BPMN Kitchen Sink',
    });
  });

  api.commands.register('ks.sendToRenderer', async () => {
    await api.bpmn.postToRendererModule({ type: 'clearHighlights' });
    api.notifications.open({
      type: 'info',
      content: 'Cleared renderer highlights.',
      source: 'BPMN Kitchen Sink',
    });
  });

  api.commands.register('ks.overlayClick', async (elementId) => {
    api.notifications.open({
      type: 'info',
      content: `Overlay clicked on gateway: ${elementId}`,
      source: 'BPMN Kitchen Sink',
    });
  });

  api.commands.register('test.isActivated', async () => {
    return {
      activated: true,
      selectedElementId,
      rendererHighlightCount,
    };
  });
}

module.exports = { activate };
