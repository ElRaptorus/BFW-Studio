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

  // Modeling API permission tests
  await api.commands.register(
    'tryModelingUpdateProperties',
    async () => {
      try {
        await api.bpmn.modeling.updateProperties('file:///test.bpmn', 'Task_1', { name: 'test' });
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
        await api.bpmn.modeling.removeElement('file:///test.bpmn', 'Task_1');
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try modeling.removeElement' },
  );

  await api.commands.register(
    'tryModelingAppendElement',
    async () => {
      try {
        await api.bpmn.modeling.appendElement('file:///test.bpmn', 'Task_1', { type: 'bpmn:Task' });
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
        await api.bpmn.modeling.createConnection('file:///test.bpmn', 'Task_1', 'Task_2');
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
        await api.bpmn.modeling.moveElement('file:///test.bpmn', 'Task_1', { x: 10, y: 0 });
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'Try modeling.moveElement' },
  );
};

exports.deactivate = () => {};
