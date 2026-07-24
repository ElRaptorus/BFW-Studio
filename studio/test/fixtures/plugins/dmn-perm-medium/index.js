/**
 * dmn-perm-medium — Permission gate test fixture
 *
 * Has 'dmn.modelling' (implies 'dmn').
 * Should succeed: getElements, setOverlays, modeling.*, palette, contextPad
 * Should fail: postToRendererModule, onRendererModuleMessage
 */

async function activate(api) {
  api.commands.register('tryModelingUpdateProperties', async (uri, elementId) => {
    try {
      await api.dmn.modeling.updateProperties(uri, elementId, { name: 'Renamed' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });

  api.commands.register('tryModelingAppendElement', async (uri, sourceElementId) => {
    try {
      const result = await api.dmn.modeling.appendElement(uri, sourceElementId, {
        type: 'dmn:Decision',
        name: 'New Decision',
      });
      return { success: true, elementId: result.elementId };
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
    try {
      await api.dmn.onRendererModuleMessage(() => {});
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });

  api.commands.register('test.isActivated', async () => {
    return { activated: true };
  });
}

module.exports = { activate };
