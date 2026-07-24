/**
 * dmn-perm-high — Permission gate test fixture
 *
 * Has 'dmn.renderer' (implies 'dmn.modelling' implies 'dmn').
 * Should succeed: ALL dmn API methods, modeling, renderer module messaging.
 */

async function activate(api) {
  let rendererMessageReceived = false;

  await api.dmn.onRendererModuleMessage((data) => {
    rendererMessageReceived = true;
  });

  api.commands.register('tryModelingUpdateProperties', async (uri, elementId) => {
    try {
      await api.dmn.modeling.updateProperties(uri, elementId, { name: 'Renamed by perm-high' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });

  api.commands.register('tryPostToRendererModule', async () => {
    try {
      await api.dmn.postToRendererModule({ type: 'ping' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });

  api.commands.register('tryOnRendererModuleMessage', async () => {
    return { success: true, received: rendererMessageReceived };
  });

  api.commands.register('test.isActivated', async () => {
    return { activated: true };
  });
}

module.exports = { activate };
