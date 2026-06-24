exports.activate = async (api) => {
  await api.commands.register(
    'tryRegisterPaletteEntry',
    async () => {
      try {
        await api.bpmn.registerPaletteEntry({
          id: 'should-fail',
          icon: 'ph-light ph-x',
          title: 'Should Fail',
          command: 'noop',
        });
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try Register Palette Entry' },
  );

  await api.commands.register(
    'tryUnregisterPaletteEntry',
    async () => {
      try {
        await api.bpmn.unregisterPaletteEntry('should-fail');
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try Unregister Palette Entry' },
  );

  await api.commands.register(
    'tryRegisterContextPadEntry',
    async () => {
      try {
        await api.bpmn.registerContextPadEntry({
          id: 'should-fail',
          icon: 'ph-light ph-x',
          title: 'Should Fail',
          command: 'noop',
        });
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try Register Context Pad Entry' },
  );

  await api.commands.register(
    'tryUnregisterContextPadEntry',
    async () => {
      try {
        await api.bpmn.unregisterContextPadEntry('should-fail');
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try Unregister Context Pad Entry' },
  );

  await api.commands.register(
    'tryUpdateContextPadEntry',
    async () => {
      try {
        await api.bpmn.updateContextPadEntry('should-fail', { elementIds: ['Task_1'] });
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try Update Context Pad Entry' },
  );
};

exports.deactivate = () => {};
