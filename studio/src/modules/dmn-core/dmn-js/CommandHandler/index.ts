import { MultiCommandHandler } from './MultiCommandHandler';
import { UpdateBusinessObjectHandler } from './UpdateBusinessObject';
import { UpdateBusinessObjectListHandler } from './UpdateBusinessObjectList';

export const DmnCommandHandler: Record<string, any> = {
  MultiCommandHandler: MultiCommandHandler,
  UpdateBusinessObjectHandler: UpdateBusinessObjectHandler,
  UpdateBusinessObjectListHandler: UpdateBusinessObjectListHandler,
};
