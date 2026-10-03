const registrationErrors = [];

exports.activate = async (api) => {
  await api.workbench.registerPage({ id: 'design/demo-board', label: 'Demo Board', icon: 'ph ph-kanban' });
  for (const id of ['nowhere/page', 'design/workspace']) {
    try {
      await api.workbench.registerPage({ id, label: 'Refused', icon: 'ph ph-x' });
    } catch (error) {
      registrationErrors.push(error.message);
    }
  }
  await api.commands.register('getRegistrationErrors', () => [...registrationErrors], {
    visibleInSearch: false,
    description: 'Page Contribution Demo: Get Registration Errors',
  });
};
