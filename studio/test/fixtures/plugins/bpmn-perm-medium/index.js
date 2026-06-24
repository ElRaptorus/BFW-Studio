/**
 * bpmn-perm-medium — Permission gate test fixture
 *
 * Has 'bpmn.modelling' (implies 'bpmn').
 * Should succeed: getElements, setOverlays, modeling.*, palette, contextPad
 * Should fail: postToRendererModule, onRendererModuleMessage
 */

async function activate(api) {
  api.commands.register('tryModelingUpdateProperties', async (uri, elementId) => {
    try {
      await api.bpmn.modeling.updateProperties(uri, elementId, { name: 'Renamed' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });

  api.commands.register('tryModelingAppendElement', async (uri, sourceElementId) => {
    try {
      const result = await api.bpmn.modeling.appendElement(uri, sourceElementId, {
        type: 'bpmn:Task',
        name: 'New Task',
      });
      return { success: true, elementId: result.elementId };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });

  api.commands.register('tryPostToRendererModule', async () => {
    try {
      await api.bpmn.postToRendererModule({ type: 'ping' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });

  api.commands.register('tryOnRendererModuleMessage', async () => {
    try {
      await api.bpmn.onRendererModuleMessage(() => {});
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
