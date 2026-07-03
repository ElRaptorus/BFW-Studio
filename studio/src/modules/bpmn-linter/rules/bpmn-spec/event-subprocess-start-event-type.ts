import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

// Start-event trigger types permitted inside an Event Sub-Process (decision
// S-B / engine `event_subprocess_untyped_start`). Compensation is excluded.
const ALLOWED_EVENT_DEFINITION_TYPES: ReadonlySet<string> = new Set([
  'bpmn:MessageEventDefinition',
  'bpmn:TimerEventDefinition',
  'bpmn:SignalEventDefinition',
  'bpmn:ConditionalEventDefinition',
  'bpmn:ErrorEventDefinition',
  'bpmn:EscalationEventDefinition',
]);

function humanizeEventDefinitionType(definitionType: string): string {
  return definitionType.replace(/^bpmn:/, '').replace(/EventDefinition$/, '');
}

/**
 * Flags an Event Sub-Process Start Event whose trigger type is not supported
 * (e.g. Compensation) and a non-interrupting Error start (an Error start must
 * interrupt). Mirrors engine `event_subprocess_untyped_start` +
 * `event_subprocess_error_start_must_interrupt`.
 *
 * The blank/untyped case is intentionally left to the built-in
 * `event-sub-process-typed-start-event` rule to avoid double-reporting.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:StartEvent')) {
      return;
    }

    const parent = node.$parent;
    if (!parent || !is(parent, 'bpmn:SubProcess') || !parent.triggeredByEvent) {
      return;
    }

    const eventDefinitions = node.eventDefinitions ?? [];
    if (eventDefinitions.length === 0) {
      return;
    }

    const definitionType = eventDefinitions[0].$type;

    if (!ALLOWED_EVENT_DEFINITION_TYPES.has(definitionType)) {
      reporter.report(
        node.id,
        `Event sub-process start event uses an unsupported trigger type "${humanizeEventDefinitionType(
          definitionType,
        )}" (BSC-014)`,
      );
      return;
    }

    const isErrorStart = definitionType === 'bpmn:ErrorEventDefinition';
    const isNonInterrupting = node.isInterrupting === false;
    if (isErrorStart && isNonInterrupting) {
      reporter.report(node.id, 'Event sub-process error start event must be interrupting (BSC-015)');
    }
  }

  return { check };
}
