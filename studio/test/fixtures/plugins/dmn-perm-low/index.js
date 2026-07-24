exports.activate = async (api) => {
  await api.commands.register(
    'tryRegisterPaletteEntry',
    async () => {
      try {
        await api.dmn.registerPaletteEntry({
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
        await api.dmn.unregisterPaletteEntry('should-fail');
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
        await api.dmn.registerContextPadEntry({
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
        await api.dmn.unregisterContextPadEntry('should-fail');
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
        await api.dmn.updateContextPadEntry('should-fail', { elementIds: ['Decision_1'] });
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try Update Context Pad Entry' },
  );

  // Modeling API permission tests
  await api.commands.register(
    'tryModelingUpdateProperties',
    async () => {
      try {
        await api.dmn.modeling.updateProperties('file:///test.dmn', 'Decision_1', { name: 'test' });
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try modeling.updateProperties' },
  );

  await api.commands.register(
    'tryModelingRemoveElement',
    async () => {
      try {
        await api.dmn.modeling.removeElement('file:///test.dmn', 'Decision_1');
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try modeling.removeElement' },
  );

  await api.commands.register(
    'tryModelingCreateElement',
    async () => {
      try {
        await api.dmn.modeling.createElement('file:///test.dmn', {
          type: 'dmn:Decision',
          position: { x: 100, y: 100 },
        });
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try modeling.createElement' },
  );

  await api.commands.register(
    'tryModelingAppendElement',
    async () => {
      try {
        await api.dmn.modeling.appendElement('file:///test.dmn', 'Decision_1', { type: 'dmn:Decision' });
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try modeling.appendElement' },
  );

  await api.commands.register(
    'tryModelingCreateConnection',
    async () => {
      try {
        await api.dmn.modeling.createConnection('file:///test.dmn', 'Decision_1', 'Decision_2');
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try modeling.createConnection' },
  );

  await api.commands.register(
    'tryModelingMoveElement',
    async () => {
      try {
        await api.dmn.modeling.moveElement('file:///test.dmn', 'Decision_1', { x: 10, y: 0 });
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try modeling.moveElement' },
  );
};

exports.deactivate = () => {};
