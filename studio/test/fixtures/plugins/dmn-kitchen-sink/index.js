/**
 * DMN Kitchen Sink — exercises all DMN editor enrichment features simultaneously:
 * - Overlays (badge + icon with onClickCommand) via a real overlay factory
 * - Palette entries (manifest-declared)
 * - Context pad entries (manifest-declared)
 * - Modeling API (updateProperties, appendElement)
 * - Renderer module injection (bidirectional channel communication)
 * - Event subscriptions (onElementSelected)
 */

async function activate(api) {
  let selectedElementId = null;
  let rendererHighlightCount = 0;

  // --- Renderer module channel ---
  await api.dmn.onRendererModuleMessage((data) => {
    if (data && data.type === 'highlightResult') {
      rendererHighlightCount = data.count;
    }
  });

  // --- Element selection tracking ---
  const focusedUri = await api.editors.getFocusedDocumentUri();
  if (focusedUri != null) {
    await api.dmn.onElementSelected(focusedUri, (event) => {
      selectedElementId = event.elementId ?? null;
    });
  }

  // --- Overlay factory: badge on all decisions, interactive icon on BKMs ---
  await api.dmn.registerOverlayFactory((context) => {
    const autoOverlays = [];
    for (const element of context.elements) {
      if (element.type === 'dmn:Decision') {
        autoOverlays.push({
          elementId: element.id,
          position: 'top-right',
          type: 'badge',
          text: 'KS',
          tooltip: 'Kitchen Sink badge',
          style: 'info',
        });
      }
      if (element.type === 'dmn:BusinessKnowledgeModel') {
        autoOverlays.push({
          elementId: element.id,
          position: 'bottom-left',
          type: 'icon',
          icon: 'ph-light ph-info',
          tooltip: 'Click for info',
          style: 'neutral',
          onClickCommand: 'plugin.dmn-kitchen-sink.ks.overlayClick',
          onClickCommandArgs: [element.id],
        });
      }
    }
    return [...context.currentOverlays, ...autoOverlays];
  });

  // --- Commands ---

  api.commands.register('ks.highlightAll', async () => {
    const currentUri = await api.editors.getFocusedDocumentUri();
    if (currentUri == null) {
      api.notifications.open({
        type: 'warning',
        content: 'No DMN document focused.',
        source: 'DMN Kitchen Sink',
      });
      return;
    }
    const elements = await api.dmn.getElements(currentUri);
    if (elements == null) {
      return;
    }
    const decisionIds = elements.filter((el) => el.type === 'dmn:Decision').map((el) => el.id);
    await api.dmn.postToRendererModule({
      type: 'highlightElements',
      elementIds: decisionIds,
    });
    api.notifications.open({
      type: 'info',
      content: `Sent ${decisionIds.length} decision IDs to renderer for highlighting.`,
      source: 'DMN Kitchen Sink',
    });
  });

  api.commands.register('ks.renameSelected', async (info) => {
    const targetId = info?.elementId || selectedElementId;
    if (targetId == null) {
      api.notifications.open({
        type: 'warning',
        content: 'No element selected to rename.',
        source: 'DMN Kitchen Sink',
      });
      return;
    }
    const currentUri = await api.editors.getFocusedDocumentUri();
    if (currentUri == null) {
      return;
    }
    await api.dmn.modeling.updateProperties(currentUri, targetId, {
      name: `Renamed by KS (${Date.now()})`,
    });
  });

  api.commands.register('ks.appendDecision', async () => {
    if (selectedElementId == null) {
      api.notifications.open({
        type: 'warning',
        content: 'Select an element first.',
        source: 'DMN Kitchen Sink',
      });
      return;
    }
    const currentUri = await api.editors.getFocusedDocumentUri();
    if (currentUri == null) {
      return;
    }
    const result = await api.dmn.modeling.appendElement(currentUri, selectedElementId, {
      type: 'dmn:Decision',
      name: 'KS Appended',
    });
    api.notifications.open({
      type: 'success',
      content: `Appended decision: ${result.elementId}`,
      source: 'DMN Kitchen Sink',
    });
  });

  api.commands.register('ks.sendToRenderer', async () => {
    await api.dmn.postToRendererModule({ type: 'clearHighlights' });
    api.notifications.open({
      type: 'info',
      content: 'Cleared renderer highlights.',
      source: 'DMN Kitchen Sink',
    });
  });

  api.commands.register('ks.overlayClick', async (elementId) => {
    api.notifications.open({
      type: 'info',
      content: `Overlay clicked on BKM: ${elementId}`,
      source: 'DMN Kitchen Sink',
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
