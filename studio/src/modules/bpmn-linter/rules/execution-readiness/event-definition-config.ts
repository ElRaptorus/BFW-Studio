import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const FLOW_ELEMENT_CONTAINER_TYPES = ['bpmn:Process', 'bpmn:SubProcess', 'bpmn:Transaction', 'bpmn:AdHocSubProcess'];

function isBlank(value: unknown): boolean {
  return value == null || String(value).trim() === '';
}

function reportOnEvent(node: ModdleNode, reporter: BpmnlintReporter, message: string): void {
  reporter.report(node.$parent?.id ?? node.id, message);
}

function linkName(node: ModdleNode): string | undefined {
  const definition = (node.eventDefinitions as ModdleNode[] | undefined)?.find((eventDefinition) =>
    is(eventDefinition, 'bpmn:LinkEventDefinition'),
  );
  return definition == null ? undefined : String(definition.name ?? '').trim();
}

export function signalEventReference() {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (is(node, 'bpmn:SignalEventDefinition') && !(node.signalRef as ModdleNode | undefined)) {
      reportOnEvent(node, reporter, 'Signal event must reference a signal (EXR-016)');
    }
  }

  return { check };
}

export function conditionalEventCondition() {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (is(node, 'bpmn:ConditionalEventDefinition') && isBlank((node.condition as ModdleNode | undefined)?.body)) {
      reportOnEvent(node, reporter, 'Conditional event must define a condition (EXR-017)');
    }
  }

  return { check };
}

export function linkEventName() {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (is(node, 'bpmn:LinkEventDefinition') && isBlank(node.name)) {
      reportOnEvent(node, reporter, 'Link event must have a name (EXR-018)');
    }
  }

  return { check };
}

/**
 * The Engine resolves a Link throw to the Link catch with the same name among
 * the flow nodes of the same scope, and fails the instance when there is none
 * or more than one.
 */
export function linkEventPairing() {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!isAny(node, FLOW_ELEMENT_CONTAINER_TYPES)) {
      return;
    }
    const flowElements = (node.flowElements as ModdleNode[] | undefined) ?? [];
    const catchCountByName = new Map<string, number>();
    for (const element of flowElements) {
      const name = is(element, 'bpmn:IntermediateCatchEvent') ? linkName(element) : undefined;
      if (name) {
        catchCountByName.set(name, (catchCountByName.get(name) ?? 0) + 1);
      }
    }
    for (const element of flowElements) {
      const name = is(element, 'bpmn:IntermediateThrowEvent') ? linkName(element) : undefined;
      if (!name) {
        continue;
      }
      const catchCount = catchCountByName.get(name) ?? 0;
      if (catchCount === 0) {
        reporter.report(
          element.id,
          `Link throw "${name}" has no Link catch with the same name in this scope (EXR-022)`,
        );
      } else if (catchCount > 1) {
        reporter.report(
          element.id,
          `Link throw "${name}" matches ${catchCount} Link catches with the same name in this scope (EXR-022)`,
        );
      }
    }
  }

  return { check };
}

export function intermediateTimerCycle() {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:TimerEventDefinition') || !node.$parent || !is(node.$parent, 'bpmn:IntermediateCatchEvent')) {
      return;
    }
    const timeCycle = node.timeCycle as ModdleNode | undefined;
    if (timeCycle != null && !isBlank(timeCycle.body)) {
      reportOnEvent(node, reporter, 'Intermediate timer catch events do not support timeCycle (EXR-023)');
    }
  }

  return { check };
}
