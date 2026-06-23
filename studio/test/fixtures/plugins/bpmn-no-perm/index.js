exports.activate = async (api) => {
  await api.commands.register(
    'trySetOverlays',
    async () => {
      try {
        await api.bpmn.setOverlays('file:///test.bpmn', [
          { elementId: 'Start_1', position: 'top-left', type: 'badge', text: 'X', style: 'info' },
        ]);
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'BPMN No Perm: Try Set Overlays' },
  );

  await api.commands.register(
    'tryGetElements',
    async () => {
      try {
        const elements = await api.bpmn.getElements('file:///test.bpmn');
        return `ok:${elements.length}`;
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'BPMN No Perm: Try Get Elements' },
  );

  await api.commands.register(
    'trySubscribe',
    async () => {
      try {
        await api.bpmn.onElementSelected('file:///test.bpmn', () => {});
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'BPMN No Perm: Try Subscribe' },
  );

  await api.commands.register(
    'tryGetXml',
    async () => {
      try {
        const xml = await api.bpmn.getXml('file:///test.bpmn');
        return `ok:${xml.length}`;
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'BPMN No Perm: Try Get XML' },
  );
};

exports.deactivate = () => {};
