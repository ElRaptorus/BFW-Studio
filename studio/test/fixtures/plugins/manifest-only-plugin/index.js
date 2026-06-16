exports.activate = async (api) => {
  console.log('[manifest-only-plugin] activated');

  await api.commands.register('manifestOnly.doThing', () => {
    api.notifications.open({
      type: 'info',
      content: 'Manifest Only Plugin: The thing has been done!',
    });
    return { done: true };
  });
};

exports.deactivate = () => {
  console.log('[manifest-only-plugin] deactivated');
};
