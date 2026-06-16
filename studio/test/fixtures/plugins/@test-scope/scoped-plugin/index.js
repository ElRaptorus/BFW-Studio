module.exports = {
  activate(api) {
    api.commands.register('ping', () => {
      return 'pong';
    });
  },
};
