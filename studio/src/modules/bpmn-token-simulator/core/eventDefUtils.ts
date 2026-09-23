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

export function isTimerEvent(element: any): boolean {
  return hasEventDefinition(element, 'bpmn:TimerEventDefinition');
}

export function isTimerCycle(element: any): boolean {
  return getEventDefinition(element, 'bpmn:TimerEventDefinition')?.timeCycle != null;
}

/** The `n` of an ISO 8601 `R<n>/…` cycle; undefined for an unbounded `R/…` or a non-cycle element. */
export function getTimerCycleRepetitions(element: any): number | undefined {
  const cycle: string | undefined = getEventDefinition(element, 'bpmn:TimerEventDefinition')?.timeCycle?.body;
  const repetitions = cycle?.trim().match(/^R(\d+)\//)?.[1];
  return repetitions === undefined ? undefined : Number(repetitions);
}

export function isConditionalEvent(element: any): boolean {
  return hasEventDefinition(element, 'bpmn:ConditionalEventDefinition');
}

export function isCompensateEvent(element: any): boolean {
  return hasEventDefinition(element, 'bpmn:CompensateEventDefinition');
}

export function isCancelEvent(element: any): boolean {
  return hasEventDefinition(element, 'bpmn:CancelEventDefinition');
}

export function getCompensateActivityRef(element: any): string | undefined {
  return getEventDefinition(element, 'bpmn:CompensateEventDefinition')?.activityRef?.id;
}

/** The compensation activity that the boundary's association points to; associations to annotations are skipped. */
export function getCompensationHandler(boundary: any): any | undefined {
  return (boundary.outgoing || []).find(
    (connection: any) =>
      connection.type === 'bpmn:Association' && connection.target?.businessObject?.isForCompensation === true,
  )?.target;
}

/** The untyped start events if any, else all of them; an event subprocess gets its single typed start event. */
export function selectStartEvents(container: any): any[] {
  const startEvents = (container.children || []).filter((child: any) => child.type === 'bpmn:StartEvent');
  const untypedStartEvents = startEvents.filter((startEvent: any) => getEventDefinitions(startEvent).length === 0);
  if (isEventSubProcess(container)) {
    return startEvents.filter((startEvent: any) => !untypedStartEvents.includes(startEvent)).slice(0, 1);
  }
  return untypedStartEvents.length > 0 ? untypedStartEvents : startEvents;
}

export function isSubProcessType(element: any): boolean {
  return (
    element.type === 'bpmn:SubProcess' || element.type === 'bpmn:Transaction' || element.type === 'bpmn:AdHocSubProcess'
  );
}

export function isEventSubProcess(element: any): boolean {
  return element.type === 'bpmn:SubProcess' && element.businessObject?.triggeredByEvent === true;
}

export function isInterruptingStart(element: any): boolean {
  return element.businessObject?.isInterrupting !== false;
}

/** A collapsed event subprocess keeps its start event on its own plane, so that one is looked up by id. */
export function findEventSubProcessStart(eventSubProcess: any, elementRegistry: any): any | undefined {
  const [startEvent] = selectStartEvents(eventSubProcess);
  if (startEvent) {
    return startEvent;
  }
  const startBusinessObject = (eventSubProcess.businessObject?.flowElements || []).find(
    (flowElement: any) => flowElement.$type === 'bpmn:StartEvent',
  );
  return startBusinessObject ? elementRegistry.get(startBusinessObject.id) : undefined;
}

/** Body of the `bfw:<name>` extension element of a business object or event definition. */
export function findBfwBody(owner: any, name: string): string | undefined {
  return owner?.extensionElements?.values?.find((value: any) => value.$type === `bfw:${name}`)?.body;
}

export function getErrorCode(element: any): string | undefined {
  const definition = getEventDefinition(element, 'bpmn:ErrorEventDefinition');
  return findBfwBody(definition, 'ErrorCode') || definition?.errorRef?.errorCode || undefined;
}

export function getEscalationCode(element: any): string | undefined {
  return getEventDefinition(element, 'bpmn:EscalationEventDefinition')?.escalationRef?.escalationCode || undefined;
}

export function getLinkName(element: any): string | undefined {
  return getEventDefinition(element, 'bpmn:LinkEventDefinition')?.name;
}

export function getSignalName(element: any): string | undefined {
  const def = getEventDefinition(element, 'bpmn:SignalEventDefinition');
  return def?.signalRef?.name;
}

/** Send and Receive Tasks carry `messageRef` on the task itself. */
export function getMessageName(element: any): string | undefined {
  const def = getEventDefinition(element, 'bpmn:MessageEventDefinition') ?? element.businessObject;
  return def?.messageRef?.name;
}

export function getMessageFlows(element: any): any[] {
  return (element.outgoing || []).filter((messageFlow: any) => messageFlow.type === 'bpmn:MessageFlow');
}
