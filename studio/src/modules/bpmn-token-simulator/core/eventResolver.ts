import type { Scope } from './Scope';
import {
  findEventSubProcessStart,
  getErrorCode,
  getEscalationCode,
  hasEventDefinition,
  isEventSubProcess,
  isInterruptingStart,
} from './eventDefUtils';

/** A boundary event with its host, or an event subprocess, that catches a thrown error or escalation. */
export interface EventCatch {
  element: any;
  scope: Scope;
  host?: any;
  interrupting: boolean;
}

type CodeReader = (element: any) => string | undefined;

/**
 * Walks upward from the throwing scope: an error event subprocess of the scope, then an
 * error boundary on the scope's host, then the same one level up. Specific codes win over catch-all.
 */
export function resolveError(scope: Scope, code: string | undefined, elementRegistry: any): EventCatch | undefined {
  return resolve(scope, code, elementRegistry, 'bpmn:ErrorEventDefinition', getErrorCode, (boundaries) => [
    selectBest(boundaries, code, getErrorCode),
  ])[0];
}

/**
 * Walks upward like `resolveError`; at a host it catches with every matching non-interrupting
 * boundary plus one interrupting boundary. Empty when nothing catches the escalation.
 */
export function resolveEscalation(scope: Scope, code: string | undefined, elementRegistry: any): EventCatch[] {
  return resolve(scope, code, elementRegistry, 'bpmn:EscalationEventDefinition', getEscalationCode, (boundaries) => [
    ...boundaries.filter((boundary) => !isInterruptingBoundary(boundary)),
    selectBest(boundaries.filter(isInterruptingBoundary), code, getEscalationCode),
  ]);
}

function resolve(
  scope: Scope,
  code: string | undefined,
  elementRegistry: any,
  definitionType: string,
  readCode: CodeReader,
  selectAtHost: (matchingBoundaries: any[]) => (any | undefined)[],
): EventCatch[] {
  const findStart = (eventSubProcess: any) => findEventSubProcessStart(eventSubProcess, elementRegistry);

  for (let current: Scope | null = scope; current; current = current.parent) {
    const eventSubProcesses = (current.element.children || []).filter((child: any) => {
      const startEvent = isEventSubProcess(child) ? findStart(child) : undefined;
      return startEvent !== undefined && hasEventDefinition(startEvent, definitionType);
    });
    const eventSubProcess = selectBest(eventSubProcesses, code, (candidate) => readCode(findStart(candidate)));
    if (eventSubProcess) {
      return [
        { element: eventSubProcess, scope: current, interrupting: isInterruptingStart(findStart(eventSubProcess)) },
      ];
    }

    const parentScope = current.parent;
    if (!parentScope) {
      break;
    }
    const matchingBoundaries = (current.element.attachers || []).filter(
      (attacher: any) =>
        attacher.type === 'bpmn:BoundaryEvent' &&
        hasEventDefinition(attacher, definitionType) &&
        matchesCode(readCode(attacher), code),
    );
    const host = current.element;
    const boundaries = selectAtHost(matchingBoundaries).filter((boundary) => boundary !== undefined);
    if (boundaries.length > 0) {
      return boundaries.map((boundary) => ({
        element: boundary,
        scope: parentScope,
        host,
        interrupting: isInterruptingBoundary(boundary),
      }));
    }
  }
  return [];
}

/** A catcher without a code catches everything; a thrower without a code is caught only by those. */
function matchesCode(catcherCode: string | undefined, throwerCode: string | undefined): boolean {
  return catcherCode === undefined || (throwerCode !== undefined && catcherCode === throwerCode);
}

function selectBest(catchers: any[], code: string | undefined, readCode: CodeReader): any | undefined {
  return (
    catchers.find((catcher) => code !== undefined && readCode(catcher) === code) ??
    catchers.find((catcher) => readCode(catcher) === undefined)
  );
}

function isInterruptingBoundary(boundary: any): boolean {
  return boundary.businessObject?.cancelActivity !== false;
}
