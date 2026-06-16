import type { ElementLike } from 'diagram-js/lib/model/Types';

const MODDLE_BPMN_EXCLUSIVE_GATEWAY = 'bpmn:ExclusiveGateway';

const MODDLE_BPMN_INCLUSIVE_GATEWAY = 'bpmn:InclusiveGateway';

export function getRoot(businessObject: any): any {
  let parent = businessObject;

  while (parent.$parent) {
    parent = parent.$parent;
  }

  return parent;
}

export function generateRandomId(): string {
  let randomId = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  const randomIdLength = 8;
  for (let i = 0; i < randomIdLength; i++) {
    randomId += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return randomId;
}

export function isSequenceFlowDefault(element: ElementLike): boolean {
  return element.businessObject.sourceRef?.default?.id === element.id;
}

export function isSequenceFlowConditional(element: ElementLike): boolean {
  const flowSourceIsExclusiveGateway = element.businessObject.sourceRef?.$type === MODDLE_BPMN_EXCLUSIVE_GATEWAY;
  const flowSourceIsInclusiveSplitGateway = element.businessObject.sourceRef?.$type === MODDLE_BPMN_INCLUSIVE_GATEWAY;

  return flowSourceIsExclusiveGateway || flowSourceIsInclusiveSplitGateway;
}

export function isHttpServiceTask(element: ElementLike): boolean {
  return element.businessObject?.get('implementation') === 'http';
}

export function isEventSubprocess(element: ElementLike): boolean {
  return element.businessObject?.get('triggeredByEvent') === true;
}
