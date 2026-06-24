/**
 * Path Tracer — diagram-js module injected into the BPMN renderer.
 *
 * Highlights all downstream-reachable elements from the hovered flow node
 * using canvas markers. Communicates with the plugin host via pluginChannel
 * for configuration (colors, enable/disable) and analysis results.
 *
 * DI dependencies: eventBus, canvas, elementRegistry, pluginChannel
 */

const MARKER_HIGHLIGHT = 'path-tracer-highlight';
const MARKER_SOURCE = 'path-tracer-source';

function PathTracerService(eventBus, canvas, elementRegistry, pluginChannel) {
  let enabled = true;
  let highlightColor = '#2196F3';
  let sourceColor = '#FF5722';
  let currentlyHighlighted = [];
  let currentSource = null;

  // --- CSS injection for markers ---
  const styleElement = document.createElement('style');
  styleElement.id = 'path-tracer-styles';
  updateStyles();
  document.head.appendChild(styleElement);

  function updateStyles() {
    styleElement.textContent = `
      .${MARKER_HIGHLIGHT}:not(.djs-connection) .djs-visual > :nth-child(1) {
        stroke: ${highlightColor} !important;
        stroke-width: 2.5px !important;
        fill: ${highlightColor}22 !important;
      }
      .${MARKER_HIGHLIGHT}.djs-connection .djs-visual > :nth-child(1) {
        stroke: ${highlightColor} !important;
        stroke-width: 3px !important;
      }
      .${MARKER_SOURCE}:not(.djs-connection) .djs-visual > :nth-child(1) {
        stroke: ${sourceColor} !important;
        stroke-width: 3px !important;
        fill: ${sourceColor}33 !important;
      }
    `;
  }

  // --- Graph traversal: find all reachable downstream elements ---
  function findReachableElements(startElement) {
    const visited = new Set();
    const queue = [startElement];

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current.id)) {
        continue;
      }
      visited.add(current.id);

      const outgoing = current.outgoing || [];
      for (const connection of outgoing) {
        if (!visited.has(connection.id)) {
          visited.add(connection.id);
          queue.push(connection);
        }
        if (connection.target && !visited.has(connection.target.id)) {
          queue.push(connection.target);
        }
      }
    }

    visited.delete(startElement.id);
    return visited;
  }

  // --- Marker management ---
  function clearHighlights() {
    for (const elementId of currentlyHighlighted) {
      try {
        canvas.removeMarker(elementId, MARKER_HIGHLIGHT);
      } catch (_) {
        // Element may have been removed
      }
    }
    if (currentSource != null) {
      try {
        canvas.removeMarker(currentSource, MARKER_SOURCE);
      } catch (_) {
        // Element may have been removed
      }
    }
    currentlyHighlighted = [];
    currentSource = null;
  }

  function highlightPaths(element) {
    clearHighlights();

    if (element.type === 'label' || element.type === 'bpmn:SequenceFlow') {
      return;
    }

    canvas.addMarker(element.id, MARKER_SOURCE);
    currentSource = element.id;

    const reachable = findReachableElements(element);

    for (const elementId of reachable) {
      try {
        canvas.addMarker(elementId, MARKER_HIGHLIGHT);
        currentlyHighlighted.push(elementId);
      } catch (_) {
        // Skip if the element no longer exists on the canvas
      }
    }

    // Send analysis results to host plugin
    pluginChannel.postMessage({
      type: 'pathAnalysis',
      sourceElementId: element.id,
      sourceElementName: element.businessObject?.name || element.id,
      reachableCount: reachable.size,
      reachableIds: [...reachable].slice(0, 50),
    });
  }

  // --- Event handlers ---
  eventBus.on('element.hover', function (event) {
    if (!enabled) {
      return;
    }
    const element = event.element;
    if (element === canvas.getRootElement()) {
      clearHighlights();
      return;
    }
    highlightPaths(element);
  });

  eventBus.on('element.out', function () {
    if (!enabled) {
      return;
    }
    clearHighlights();
  });

  eventBus.on('diagram.destroy', function () {
    clearHighlights();
    if (styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
    }
  });

  // --- Channel messages from host plugin ---
  pluginChannel.onMessage(function (data) {
    if (data == null || typeof data !== 'object') {
      return;
    }

    switch (data.type) {
      case 'setEnabled':
        enabled = Boolean(data.enabled);
        if (!enabled) {
          clearHighlights();
        }
        pluginChannel.postMessage({ type: 'stateChanged', enabled });
        break;

      case 'setColors':
        if (typeof data.highlightColor === 'string') {
          highlightColor = data.highlightColor;
        }
        if (typeof data.sourceColor === 'string') {
          sourceColor = data.sourceColor;
        }
        updateStyles();
        pluginChannel.postMessage({
          type: 'colorsChanged',
          highlightColor,
          sourceColor,
        });
        break;

      case 'getState':
        pluginChannel.postMessage({ type: 'stateChanged', enabled });
        break;

      default:
        break;
    }
  });
}

PathTracerService.$inject = ['eventBus', 'canvas', 'elementRegistry', 'pluginChannel'];

// Export as a diagram-js module descriptor
module.exports = {
  __init__: ['pathTracerService'],
  pathTracerService: ['type', PathTracerService],
};
