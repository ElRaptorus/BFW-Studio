/**
 * bpmn-perm-high — Permission gate test fixture
 *
 * Has 'bpmn.renderer' (implies 'bpmn.modelling' implies 'bpmn').
 * Should succeed: ALL bpmn API methods, modeling, renderer module messaging.
 */

async function activate(api) {
  let rendererMessageReceived = false;

  await api.bpmn.onRendererModuleMessage((data) => {
    rendererMessageReceived = true;
  });

  await api.commands.register('tryModelingUpdateProperties', async (uri, elementId) => {
    try {
      await api.bpmn.modeling.updateProperties(uri, elementId, { name: 'Renamed by perm-high' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });

  await api.commands.register('tryPostToRendererModule', async () => {
    try {
      await api.bpmn.postToRendererModule({ type: 'ping' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });

  await api.commands.register('tryOnRendererModuleMessage', async () => {
    return { success: true, received: rendererMessageReceived };
  });

  await api.commands.register('test.isActivated', async () => {
    return { activated: true };
  });
}

module.exports = { activate };
