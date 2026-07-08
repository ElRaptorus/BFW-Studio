import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

// Start-event trigger types that are invalid at the top level of a process.
// Conditional is intentionally excluded here: its top-level semantics are still
// open and left unchanged for now. These three are only valid inside an Event
// Sub-Process, where a scope instance exists.
const FORBIDDEN_TOP_LEVEL_START_TYPES: ReadonlySet<string> = new Set([
  'bpmn:ErrorEventDefinition',
  'bpmn:EscalationEventDefinition',
  'bpmn:CompensateEventDefinition',
]);

function humanizeEventDefinitionType(definitionType: string): string {
  return definitionType.replace(/^bpmn:/, '').replace(/EventDefinition$/, '');
}

/**
 * Flags a top-level process Start Event whose trigger type is Error, Escalation
 * or Compensation. These triggers require a surrounding scope instance and are
 * only valid inside an Event Sub-Process, matching the engine's top-level start
 * event allow-list.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:StartEvent')) {
      return;
    }

    const parent = node.$parent;
    if (!parent || !is(parent, 'bpmn:Process')) {
      return;
    }

    const eventDefinitions = node.eventDefinitions ?? [];
    if (eventDefinitions.length === 0) {
      return;
    }

    const definitionType = eventDefinitions[0].$type;
    if (FORBIDDEN_TOP_LEVEL_START_TYPES.has(definitionType)) {
      reporter.report(
        node.id,
        `Top-level process start event uses an unsupported trigger type "${humanizeEventDefinitionType(
          definitionType,
        )}" (BSC-019)`,
      );
    }
  }

  return { check };
}
