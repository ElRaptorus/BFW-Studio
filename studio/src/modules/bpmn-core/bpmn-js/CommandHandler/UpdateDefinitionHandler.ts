export function UpdateDefinitionHandler(this: any): void {}

UpdateDefinitionHandler.prototype.execute = (context: any) => {
  const { element, newDefinitionId } = context;

  if (newDefinitionId == null || newDefinitionId.trim() === '') {
    return;
  }

  context.oldId = element.get('id');
  element.set('id', newDefinitionId);

  return context;
};

UpdateDefinitionHandler.prototype.revert = (context) => {
  const { oldId, element } = context;

  element.set('id', oldId);

  return context;
};

export default UpdateDefinitionHandler;
