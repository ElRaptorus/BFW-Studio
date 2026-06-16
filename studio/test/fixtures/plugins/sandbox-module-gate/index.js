module.exports = {
  async activate(api) {
    await api.commands.register(
      'tryRequireFs',
      () => {
        try {
          require('fs');
          return 'ok';
        } catch (err) {
          return err.message;
        }
      },
      { visibleInSearch: true, description: 'Module Gate: Test FS Require' },
    );

    await api.commands.register('tryRequireHttp', () => {
      try {
        require('http');
        return 'ok';
      } catch (err) {
        return err.message;
      }
    });

    await api.commands.register('tryRequireOs', () => {
      try {
        const os = require('os');
        return os.platform();
      } catch (err) {
        return err.message;
      }
    });

    await api.commands.register('tryRequirePath', () => {
      try {
        const path = require('path');
        return path.join('a', 'b');
      } catch (err) {
        return err.message;
      }
    });
  },
};
