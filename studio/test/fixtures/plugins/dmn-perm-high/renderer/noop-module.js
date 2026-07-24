/**
 * Minimal no-op diagram-js module for permission gate testing.
 * Proves that 'dmn.renderer' permission allows module loading.
 */

function NoopService(pluginChannel) {
  pluginChannel.onMessage(function (data) {
    if (data && data.type === 'ping') {
      pluginChannel.postMessage({ type: 'pong' });
    }
  });
}

NoopService.$inject = ['pluginChannel'];

module.exports = {
  __init__: ['noopService'],
  noopService: ['type', NoopService],
};
