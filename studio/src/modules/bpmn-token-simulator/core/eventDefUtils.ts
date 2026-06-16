export function getEventDefinitions(element: any): any[] {
  return element.businessObject?.eventDefinitions || [];
}

export function hasEventDefinition(element: any, type: string): boolean {
  return getEventDefinitions(element).some((eventDefinition: any) => eventDefinition.$type === type);
}

export function getEventDefinition(element: any, type: string): any | undefined {
  return getEventDefinitions(element).find((eventDefinition: any) => eventDefinition.$type === type);
}

export function isMessageEvent(element: any): boolean {
  return hasEventDefinition(element, 'bpmn:MessageEventDefinition');
}

export function isSignalEvent(element: any): boolean {
  return hasEventDefinition(element, 'bpmn:SignalEventDefinition');
}

export function isLinkEvent(element: any): boolean {
  return hasEventDefinition(element, 'bpmn:LinkEventDefinition');
}

export function isTerminateEvent(element: any): boolean {
  return hasEventDefinition(element, 'bpmn:TerminateEventDefinition');
}

export function isErrorEvent(element: any): boolean {
  return hasEventDefinition(element, 'bpmn:ErrorEventDefinition');
}

export function isEscalationEvent(element: any): boolean {
  return hasEventDefinition(element, 'bpmn:EscalationEventDefinition');
}

export function getLinkName(element: any): string | undefined {
  return getEventDefinition(element, 'bpmn:LinkEventDefinition')?.name;
}

export function getSignalName(element: any): string | undefined {
  const def = getEventDefinition(element, 'bpmn:SignalEventDefinition');
  return def?.signalRef?.name;
}

export function getMessageName(element: any): string | undefined {
  const def = getEventDefinition(element, 'bpmn:MessageEventDefinition');
  return def?.messageRef?.name;
}

export function getMessageFlows(element: any): any[] {
  return (element.outgoing || []).filter((messageFlow: any) => messageFlow.type === 'bpmn:MessageFlow');
}
