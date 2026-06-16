module.exports = {
  activate(api) {
    api.commands.register('crash', () => {
      process.exit(1);
    });

    api.commands.register('throwUncaught', () => {
      throw new Error('Intentional uncaught error from sandbox-crash');
    });
  },
};
