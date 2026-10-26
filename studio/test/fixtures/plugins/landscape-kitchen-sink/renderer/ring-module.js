/**
 * Kitchen Sink renderer module for the landscape map: marks elements with a CSS marker on request from the plugin.
 *
 * DI dependencies: eventBus, canvas, pluginChannel
 */

const MARKER_RING = 'ks-ring';

function RingMarker(eventBus, canvas, pluginChannel) {
  let markedElements = [];

  function clearMarkers() {
    for (const elementId of markedElements) {
      try {
        canvas.removeMarker(elementId, MARKER_RING);
      } catch (_) {}
    }
    markedElements = [];
  }

  pluginChannel.onMessage(function (data) {
    if (data == null || typeof data !== 'object') {
      return;
    }
    if (data.type === 'ring') {
      clearMarkers();
      for (const elementId of Array.isArray(data.elementIds) ? data.elementIds : []) {
        try {
          canvas.addMarker(elementId, MARKER_RING);
          markedElements.push(elementId);
        } catch (_) {}
      }
      pluginChannel.postMessage({ type: 'ringResult', count: markedElements.length });
    }
    if (data.type === 'clear') {
      clearMarkers();
      pluginChannel.postMessage({ type: 'ringResult', count: 0 });
    }
  });

  eventBus.on('diagram.destroy', clearMarkers);
}

RingMarker.$inject = ['eventBus', 'canvas', 'pluginChannel'];

module.exports = {
  __init__: ['ringMarker'],
  ringMarker: ['type', RingMarker],
};
