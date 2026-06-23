module.exports = {
  activate(api) {
    api.commands.register('crash', () => {
      // Throw inside setTimeout to produce an uncaught exception that
      // terminates the worker thread. Errors thrown inside setTimeout
      // callbacks bypass the sandbox's Promise-based error handling and
      // trigger the worker's uncaughtException path, causing process exit.
      setTimeout(() => {
        throw new Error('INTENTIONAL_CRASH');
      }, 1);
    });

    api.commands.register('throwUncaught', () => {
      throw new Error('Intentional uncaught error from sandbox-crash');
    });
  },
};
