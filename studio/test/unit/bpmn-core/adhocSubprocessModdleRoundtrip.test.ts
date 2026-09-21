import { BpmnModdle } from 'bpmn-moddle';
import { describe, expect, it } from 'vitest';

import bfwPlatformModdleDescriptor from '../../../src/modules/bpmn-core/bpmn-js/moddle/bfw-platform.json';

// Regression coverage for the Ad-hoc Sub-Process moddle schema. `ordering` and
// `cancelRemainingInstances` are declared by upstream bpmn-moddle, but `implementation`
// is an engine-specific addition that is NOT part of the standard BPMN AdHocSubProcess
// schema. Without an explicit "extends" entry in bfw-platform.json, setting
// `businessObject.implementation` in the editor is silently dropped by the XML writer —
// the property survives in memory for the current session but is lost on save, and never
// comes back on the next load. This test parses -> serializes -> re-parses to catch that
// class of "editor writes it, but the file never sees it" bug for every ad-hoc property.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bfw="https://bifrostforge.world/schema/bpmn"
  id="Definitions_1"
  targetNamespace="https://bifrostforge.world/schema/bpmn">
  <bpmn:process id="process_1" isExecutable="true">
    <bpmn:adHocSubProcess id="AdHoc_1" name="Toolbox" ordering="Sequential" cancelRemainingInstances="false">
      <bpmn:extensionElements>
        <bfw:ActiveElements>["Task_1", "Task_2"]</bfw:ActiveElements>
      </bpmn:extensionElements>
      <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">activeCount = 0</bpmn:completionCondition>
      <bpmn:task id="Task_1" />
      <bpmn:task id="Task_2" />
    </bpmn:adHocSubProcess>
  </bpmn:process>
</bpmn:definitions>`;

function createModdle(): InstanceType<typeof BpmnModdle> {
  return new BpmnModdle({ bfw: bfwPlatformModdleDescriptor });
}

describe('Ad-hoc Sub-Process moddle roundtrip', () => {
  it('parses every standard and bfw: property from XML', async () => {
    const moddle = createModdle();
    const { rootElement } = await moddle.fromXML(XML);
    const adHoc = rootElement.rootElements[0].flowElements[0];

    expect(adHoc.ordering).toBe('Sequential');
    expect(adHoc.cancelRemainingInstances).toBe(false);
    expect(adHoc.completionCondition?.body).toBe('activeCount = 0');

    const activeElements = adHoc.extensionElements?.values?.find((value: any) => value.$type === 'bfw:ActiveElements');
    expect(activeElements?.body).toBe('["Task_1", "Task_2"]');
  });

  it('round-trips implementation set in-memory (the editor code path) through save + reload', async () => {
    const moddle = createModdle();
    const { rootElement } = await moddle.fromXML(XML);
    const adHoc = rootElement.rootElements[0].flowElements[0];

    // Mirrors what UpdateAdHocSubprocessHandler does: CmdHelper.updateBusinessObject
    // ultimately assigns the new value directly onto the moddle business object.
    adHoc.implementation = 'ai-toolbox';

    const { xml } = await moddle.toXML(rootElement);
    expect(xml).toContain('implementation="ai-toolbox"');

    const reparsedModdle = createModdle();
    const { rootElement: reparsedRoot } = await reparsedModdle.fromXML(xml);
    const reparsedAdHoc = reparsedRoot.rootElements[0].flowElements[0];

    expect(reparsedAdHoc.implementation).toBe('ai-toolbox');
    // Sibling properties must survive alongside the newly-set implementation.
    expect(reparsedAdHoc.ordering).toBe('Sequential');
    expect(reparsedAdHoc.cancelRemainingInstances).toBe(false);
    expect(reparsedAdHoc.completionCondition?.body).toBe('activeCount = 0');
  });

  it('round-trips ordering, cancelRemainingInstances, and bfw:ActiveElements changes', async () => {
    const moddle = createModdle();
    const { rootElement } = await moddle.fromXML(XML);
    const adHoc = rootElement.rootElements[0].flowElements[0];

    adHoc.ordering = 'Parallel';
    adHoc.cancelRemainingInstances = true;
    const activeElements = adHoc.extensionElements.values.find((value: any) => value.$type === 'bfw:ActiveElements');
    activeElements.body = '["Task_2"]';

    const { xml } = await moddle.toXML(rootElement);
    const reparsedModdle = createModdle();
    const { rootElement: reparsedRoot } = await reparsedModdle.fromXML(xml);
    const reparsedAdHoc = reparsedRoot.rootElements[0].flowElements[0];

    expect(reparsedAdHoc.ordering).toBe('Parallel');
    expect(reparsedAdHoc.cancelRemainingInstances).toBe(true);
    const reparsedActiveElements = reparsedAdHoc.extensionElements.values.find(
      (value: any) => value.$type === 'bfw:ActiveElements',
    );
    expect(reparsedActiveElements?.body).toBe('["Task_2"]');
  });

  it('drops the implementation attribute entirely when cleared (matches "engine-managed" default)', async () => {
    const moddle = createModdle();
    const { rootElement } = await moddle.fromXML(XML);
    const adHoc = rootElement.rootElements[0].flowElements[0];

    adHoc.implementation = 'ai-toolbox';
    let { xml } = await moddle.toXML(rootElement);
    expect(xml).toContain('implementation="ai-toolbox"');

    adHoc.implementation = undefined;
    ({ xml } = await moddle.toXML(rootElement));
    expect(xml).not.toContain('implementation=');
  });
});
