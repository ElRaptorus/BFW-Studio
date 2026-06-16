exports.activate = async (api) => {
  console.log('[manifest-full] activated');

  await api.commands.register('manifestFull.greet', () => {
    api.notifications.open({
      type: 'info',
      content: 'Hello from Manifest Full!',
    });
    return { greeted: true };
  });

  await api.commands.register('manifestFull.farewell', () => {
    api.notifications.open({
      type: 'info',
      content: 'Goodbye from Manifest Full!',
    });
    return { farewelled: true };
  });
};

exports.deactivate = () => {
  console.log('[manifest-full] deactivated');
};
