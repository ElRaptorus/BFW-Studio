exports.activate = async (api) => {
  console.log('[manifest-warnings] activated — despite having warnings');

  await api.commands.register('manifestWarnings.hello', () => {
    return { hello: true };
  });
};

exports.deactivate = () => {
  console.log('[manifest-warnings] deactivated');
};
