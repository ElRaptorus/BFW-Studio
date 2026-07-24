/**
 * Kitchen Sink renderer module — highlights DRD elements on command from the host plugin.
 *
 * DI dependencies: eventBus, canvas, elementRegistry, pluginChannel
 */

const MARKER_KS_HIGHLIGHT = 'ks-highlight';

const HIGHLIGHT_CSS = `
.${MARKER_KS_HIGHLIGHT} .djs-visual > :first-child {
  stroke: #ff9800 !important;
  stroke-width: 3px !important;
}
.${MARKER_KS_HIGHLIGHT} .djs-outline {
  visibility: visible !important;
  stroke: #ff9800 !important;
  fill: rgba(255, 152, 0, 0.1) !important;
}
`;

let styleInjected = false;

function injectHighlightStyles() {
  if (styleInjected) return;
  const style = document.createElement('style');
  style.textContent = HIGHLIGHT_CSS;
  document.head.appendChild(style);
  styleInjected = true;
}

function KitchenSinkHighlighter(eventBus, canvas, elementRegistry, pluginChannel) {
  injectHighlightStyles();
  let highlightedElements = [];

  function clearHighlights() {
    for (const elementId of highlightedElements) {
      try {
        canvas.removeMarker(elementId, MARKER_KS_HIGHLIGHT);
      } catch (_) {}
    }
    highlightedElements = [];
  }

  pluginChannel.onMessage(function (data) {
    if (data == null || typeof data !== 'object') {
      return;
    }

    switch (data.type) {
      case 'highlightElements': {
        clearHighlights();
        const ids = Array.isArray(data.elementIds) ? data.elementIds : [];
        for (const elementId of ids) {
          try {
            canvas.addMarker(elementId, MARKER_KS_HIGHLIGHT);
            highlightedElements.push(elementId);
          } catch (_) {}
        }
        pluginChannel.postMessage({
          type: 'highlightResult',
          count: highlightedElements.length,
        });
        break;
      }
      case 'clearHighlights':
        clearHighlights();
        pluginChannel.postMessage({ type: 'highlightResult', count: 0 });
        break;
      default:
        break;
    }
  });

  eventBus.on('diagram.destroy', function () {
    clearHighlights();
  });
}

KitchenSinkHighlighter.$inject = ['eventBus', 'canvas', 'elementRegistry', 'pluginChannel'];

module.exports = {
  __init__: ['kitchenSinkHighlighter'],
  kitchenSinkHighlighter: ['type', KitchenSinkHighlighter],
};
