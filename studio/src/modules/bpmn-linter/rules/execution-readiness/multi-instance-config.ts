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

function getExtensionBody(parent: ModdleNode, type: string): string | undefined {
  const extEl = parent.extensionElements as { values?: ModdleNode[] } | undefined;
  const extensions = extEl?.values;
  if (!extensions) {
    return undefined;
  }
  const match = extensions.find((ext) => ext.$type === type);
  const body = match?.body;
  if (body == null) {
    return undefined;
  }
  return String(body);
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!isAny(node, ACTIVITY_TYPES)) {
      return;
    }
    const loop = node.loopCharacteristics as ModdleNode | undefined;
    if (loop == null || !is(loop, 'bpmn:MultiInstanceLoopCharacteristics')) {
      return;
    }

    const hasEvilInputCollection = !!getExtensionBody(loop, 'evil:InputCollection');
    const hasInputDataItem = !!(loop.inputDataItem as ModdleNode | undefined);
    const hasLoopDataInputRef = !!(loop.loopDataInputRef as ModdleNode | undefined);
    const hasCamundaCollection = !!(
      loop.$attrs &&
      (loop.$attrs['camunda:collection'] || loop.$attrs['flowable:collection'])
    );

    if (!hasEvilInputCollection && !hasInputDataItem && !hasLoopDataInputRef && !hasCamundaCollection) {
      reporter.report(
        node.id,
        'Multi-instance must define an Input Collection (evil:InputCollection) or a data item / collection reference (EXR-010)',
      );
    }

    const hasLoopCardinality = !!(loop.loopCardinality as ModdleNode | undefined);
    if (hasLoopCardinality) {
      reporter.report(
        node.id,
        'loopCardinality is not supported by the engine — use Input Collection instead (EXR-010)',
      );
    }

    const maxIterationsRaw = getExtensionBody(loop, 'evil:MaxIterations');
    if (maxIterationsRaw != null && maxIterationsRaw.trim() !== '') {
      const parsed = parseInt(maxIterationsRaw.trim(), 10);
      if (isNaN(parsed) || parsed <= 0) {
        reporter.report(node.id, 'evil:maxIterations must be a positive integer (EXR-010)');
      }
    }
  }

  return { check };
}
