const events = [];
let pluginApi;

exports.activate = async (api) => {
  pluginApi = api;
  events.push('activated');
  await api.commands.register('getLifecycleEvents', () => [...events], {
    visibleInSearch: true,
    description: 'Lifecycle: Get Events',
  });
};

exports.deactivate = async () => {
  events.push('deactivated');
  if (pluginApi) {
    try {
      await pluginApi.settings.set('plugin.lifecycle-plugin.deactivatedAt', Date.now().toString());
    } catch {
      // Settings bridge may already be torn down during full shutdown
    }
  }
};
