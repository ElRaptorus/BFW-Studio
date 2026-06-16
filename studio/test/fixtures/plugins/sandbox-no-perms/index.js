module.exports = {
  async activate(api) {
    await api.commands.register(
      'tryWorkspace',
      async () => {
        try {
          await api.workspace.readFile('file:///nonexistent');
          return 'ok';
        } catch (err) {
          return err.message;
        }
      },
      { visibleInSearch: true, description: 'No Perms: Try Workspace Read' },
    );

    await api.commands.register('tryBlockedCommand', async () => {
      try {
        await api.commands.executeCommand('git.commit');
        return 'ok';
      } catch (err) {
        return err.message;
      }
    });

    await api.commands.register('tryStdCommand', async () => {
      try {
        await api.commands.executeCommand('std.notifications.show', 'hello');
        return 'ok';
      } catch (err) {
        return err.message;
      }
    });

    await api.commands.register('trySettingsWrite', async () => {
      try {
        await api.settings.set('theme', 'dark');
        return 'ok';
      } catch (err) {
        return err.message;
      }
    });

    await api.commands.register('tryOwnSettings', async () => {
      try {
        await api.settings.set('plugin.sandbox-no-perms.foo', 'bar');
        return 'ok';
      } catch (err) {
        return err.message;
      }
    });

    await api.commands.register('tryFileWatcher', async () => {
      try {
        await api.workspace.onDidChangeFile('file:///tmp', () => {});
        return 'ok';
      } catch (err) {
        return err.message;
      }
    });
  },
};
