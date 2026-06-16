let deactivated = false;

exports.activate = async (api) => {
  await api.commands.register('greet', (name) => `Hello, ${name}!`, {
    visibleInSearch: true,
    description: 'Happy Plugin: Greet',
  });
  await api.commands.register('getEnv', () => ({
    pluginPath: api.env.pluginPath,
    pluginName: api.env.pluginName,
    storagePath: api.env.storagePath,
    apiVersion: api.env.apiVersion,
  }));
  await api.commands.register('isDeactivated', () => deactivated);

  api.notifications.open({ type: 'info', content: 'happy-plugin activated' });
};

exports.deactivate = () => {
  deactivated = true;
};
