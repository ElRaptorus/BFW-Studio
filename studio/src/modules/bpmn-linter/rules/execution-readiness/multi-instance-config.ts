import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const ACTIVITY_TYPES = [
  'bpmn:Task',
  'bpmn:ServiceTask',
  'bpmn:UserTask',
  'bpmn:ScriptTask',
  'bpmn:ReceiveTask',
  'bpmn:SendTask',
  'bpmn:ManualTask',
  'bpmn:BusinessRuleTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess',
];

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!isAny(node, ACTIVITY_TYPES)) {
      return;
    }
    const loop = node.loopCharacteristics as ModdleNode | undefined;
    if (loop == null || !is(loop, 'bpmn:MultiInstanceLoopCharacteristics')) {
      return;
    }
    const hasCardinality = !!(loop.loopCardinality as ModdleNode | undefined);
    const hasInput = !!(loop.inputDataItem as ModdleNode | undefined);
    const hasCollection =
      !!(loop.loopDataInputRef as ModdleNode | undefined) ||
      !!(loop.collection as string | undefined) ||
      !!(loop.$attrs && (loop.$attrs['camunda:collection'] || loop.$attrs['flowable:collection']));

    if (!hasCardinality && !hasInput && !hasCollection) {
      reporter.report(
        node.id,
        'Multi-instance should define loopCardinality, collection/input, or data item (EXR-010)',
      );
    }
  }

  return { check };
}
