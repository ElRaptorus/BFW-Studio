/**
 * BPMN Path Tracer — Host Plugin
 *
 * Demonstrates the renderer module injection API (Batch 8.4):
 * - Bidirectional communication with a renderer-injected diagram-js module
 * - Host-side configuration pushed to the renderer via postToRendererModule
 * - Renderer-side analysis results received via onRendererModuleMessage
 * - Palette entry for toggling the feature on/off
 * - Command for changing the tracer color scheme
 */

const COLOR_SCHEMES = {
  blue: { highlightColor: '#2196F3', sourceColor: '#FF5722' },
  green: { highlightColor: '#4CAF50', sourceColor: '#9C27B0' },
  orange: { highlightColor: '#FF9800', sourceColor: '#E91E63' },
  teal: { highlightColor: '#009688', sourceColor: '#795548' },
};

async function activate(api) {
  let tracerEnabled = true;
  let currentColorScheme = 'blue';

  // Listen for messages from the renderer module
  await api.bpmn.onRendererModuleMessage((data) => {
    if (data == null || typeof data !== 'object') {
      return;
    }

    switch (data.type) {
      case 'pathAnalysis':
        // Renderer analyzed downstream paths — could log, store, or display
        // For the demo, we show a brief notification for large path counts
        if (data.reachableCount > 5) {
          api.notifications.open({
            type: 'info',
            content: `Path tracer: "${data.sourceElementName}" can reach ${data.reachableCount} downstream elements.`,
            source: 'Path Tracer',
          });
        }
        break;

      case 'stateChanged':
        tracerEnabled = data.enabled;
        break;

      case 'colorsChanged':
        break;

      default:
        break;
    }
  });

  // Request initial state sync from renderer
  await api.bpmn.postToRendererModule({ type: 'getState' });

  // --- Commands ---

  api.commands.register('togglePathTracer', async () => {
    tracerEnabled = !tracerEnabled;
    await api.bpmn.postToRendererModule({
      type: 'setEnabled',
      enabled: tracerEnabled,
    });
    api.notifications.open({
      type: 'info',
      content: `Path tracer ${tracerEnabled ? 'enabled' : 'disabled'}.`,
      source: 'Path Tracer',
    });
  });

  api.commands.register('setTracerColor', async () => {
    const schemes = Object.keys(COLOR_SCHEMES);
    const currentIndex = schemes.indexOf(currentColorScheme);
    const nextIndex = (currentIndex + 1) % schemes.length;
    currentColorScheme = schemes[nextIndex];

    const colors = COLOR_SCHEMES[currentColorScheme];
    await api.bpmn.postToRendererModule({
      type: 'setColors',
      ...colors,
    });
    api.notifications.open({
      type: 'info',
      content: `Path tracer color scheme: ${currentColorScheme}.`,
      source: 'Path Tracer',
    });
  });
}

module.exports = { activate };
