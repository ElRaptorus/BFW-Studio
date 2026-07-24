exports.activate = async (api) => {
  await api.commands.register(
    'trySetOverlays',
    async () => {
      try {
        await api.dmn.setOverlays('file:///test.dmn', [
          { elementId: 'Decision_1', position: 'top-left', type: 'badge', text: 'X', style: 'info' },
        ]);
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'DMN No Perm: Try Set Overlays' },
  );

  await api.commands.register(
    'tryGetElements',
    async () => {
      try {
        const elements = await api.dmn.getElements('file:///test.dmn');
        return `ok:${elements.length}`;
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'DMN No Perm: Try Get Elements' },
  );

  await api.commands.register(
    'trySubscribe',
    async () => {
      try {
        await api.dmn.onElementSelected('file:///test.dmn', () => {});
        return 'ok';
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'DMN No Perm: Try Subscribe' },
  );

  await api.commands.register(
    'tryGetXml',
    async () => {
      try {
        const xml = await api.dmn.getXml('file:///test.dmn');
        return `ok:${xml.length}`;
      } catch (err) {
        return err.message;
      }
    },
    { visibleInSearch: true, description: 'DMN No Perm: Try Get XML' },
  );
};

exports.deactivate = () => {};
