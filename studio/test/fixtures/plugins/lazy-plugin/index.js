let activated = false;

exports.activate = async (api) => {
  activated = true;
  console.log('[lazy-plugin] activated');

  await api.commands.register('lazyPlugin.activate', () => {
    return { activated: true, greeting: 'Lazy plugin is now active!' };
  });
};

exports.deactivate = () => {
  activated = false;
  console.log('[lazy-plugin] deactivated');
};
