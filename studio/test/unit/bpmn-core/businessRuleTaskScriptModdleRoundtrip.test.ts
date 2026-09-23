import { describe, expect, it } from 'vitest';

import { createBpmnModdleForDiff } from '../../../src/modules/bpmn-core/diff/bpmnModdleForDiff';

// The Engine reads the Business Rule Task FEEL body from <bpmn:script>. That child is not
// part of tBusinessRuleTask in the BPMN 2.0 XSD, so bfw-platform.json declares it; without
// that entry the editor drops the script on save.
function definitionsXml(taskBody: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bfw="https://bifrostforge.world/schema/bpmn"
  id="Definitions_1"
  targetNamespace="https://bifrostforge.world/schema/bpmn">
  <bpmn:process id="process_1" isExecutable="true">
    <bpmn:businessRuleTask id="BusinessRuleTask_1" implementation="feel">${taskBody}</bpmn:businessRuleTask>
  </bpmn:process>
</bpmn:definitions>`;
}

async function importBusinessRuleTask(taskBody: string) {
  const moddle = createBpmnModdleForDiff();
  const { rootElement, warnings } = await moddle.fromXML(definitionsXml(taskBody));
  return { moddle, rootElement, warnings, task: rootElement.rootElements[0].flowElements[0] };
}

describe('Business Rule Task script moddle roundtrip', () => {
  it('reads <bpmn:script> into element.script without warnings', async () => {
    const { task, warnings } = await importBusinessRuleTask('<bpmn:script>{ discount: 0.1 }</bpmn:script>');

    expect(task.script).toBe('{ discount: 0.1 }');
    expect(warnings).toHaveLength(0);
  });

  it('writes element.script back as <bpmn:script>', async () => {
    const { moddle, rootElement } = await importBusinessRuleTask('<bpmn:script>{ discount: 0.1 }</bpmn:script>');

    const { xml } = await moddle.toXML(rootElement);

    expect(xml).toContain('<bpmn:script>{ discount: 0.1 }</bpmn:script>');
    expect(xml).not.toContain('bfw:script');
  });

  it('serializes a script set on a newly created Business Rule Task as <bpmn:script>', async () => {
    const moddle = createBpmnModdleForDiff();
    const task = moddle.create('bpmn:BusinessRuleTask', { id: 'BusinessRuleTask_2', script: 'x' });

    const { xml } = await moddle.toXML(task);

    expect(xml).toContain('<bpmn:script>x</bpmn:script>');
  });

  it('does not read legacy <bfw:script>', async () => {
    const { task, warnings } = await importBusinessRuleTask('<bfw:script>legacy</bfw:script>');

    expect(task.script).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });
});
