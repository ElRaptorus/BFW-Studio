exports.activate = async (api) => {
  await api.commands.register('call', async (method, args) => {
    try {
      const segments = method.split('.');
      const name = segments.pop();
      const owner = segments.reduce((target, segment) => target[segment], api.landscape);
      const result = await owner[name](...(args ?? []));
      return { success: true, result: result ?? null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};

exports.deactivate = () => {};
