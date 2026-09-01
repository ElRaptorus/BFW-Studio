import assert from 'node:assert';
import { describe, it } from 'vitest';

import { parseBpmnDefinitionsFromXml } from '../../../src/modules/bpmn-core/diff/bpmnModdleForDiff';
import { buildModdleElementRegistry, lintBpmnXmlOnDisk } from '../../../src/modules/bpmn-linter/lintOnDisk';
import { countScorableElements } from '../../../src/modules/bpmn-linter/scoring/isScorableElement';

const DAEMON_ENGINE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:evil="https://evilengine.dev/schema/bpmn"
  id="Definitions_1"
  targetNamespace="https://evilengine.dev/schema/bpmn"
  exporter="Bifrost Forge World">
  <bpmn:process id="process_1" isExecutable="true">
    <bpmn:extensionElements>
      <evil:Version>1.0.0</evil:Version>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Start_1">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_1">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_1">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </bpmn:process>
</bpmn:definitions>`;

const CAMUNDA_FOREIGN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
  id="Definitions_foreign"
  targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="Camunda Modeler">
  <bpmn:process id="process_foreign" isExecutable="true">
    <bpmn:startEvent id="Start_foreign" />
  </bpmn:process>
</bpmn:definitions>`;

const POOL_LANE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:evil="https://evilengine.dev/schema/bpmn"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_CaCascadeParentThenAbort"
  targetNamespace="https://evilengine.dev/schema/bpmn"
  exporter="Bifrost Forge World">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="Pool" processRef="Process_1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" name="Process" isExecutable="true">
    <bpmn:extensionElements>
      <evil:version>1.0.0</evil:version>
    </bpmn:extensionElements>
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_default" name="default">
        <bpmn:flowNodeRef>Start_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_1" name="Start" />
    <bpmn:task id="Task_1" name="Task" />
    <bpmn:endEvent id="End_1" name="Done" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Shape_Participant" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="82" y="130" width="686" height="140" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Lane_default" bpmnElement="Lane_default" isHorizontal="true">
        <dc:Bounds x="112" y="130" width="656" height="140" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Start_1" bpmnElement="Start_1">
        <dc:Bounds x="162" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_1" bpmnElement="Task_1">
        <dc:Bounds x="260" y="160" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_End_1" bpmnElement="End_1">
        <dc:Bounds x="430" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Flow_1" bpmnElement="Flow_1">
        <di:waypoint x="198" y="200" />
        <di:waypoint x="260" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow_2" bpmnElement="Flow_2">
        <di:waypoint x="360" y="200" />
        <di:waypoint x="430" y="200" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const DISK_OPTIONS = {
  profileName: 'bpmn-development',
  customRulesets: {},
  alwaysLintForeignDiagrams: false,
};

const CANVAS_LIKE_POOL_LANE_IDS = ['End_1', 'Flow_1', 'Flow_2', 'Lane_default', 'Participant_1', 'Start_1', 'Task_1'];

describe('lintBpmnXmlOnDisk', () => {
  it('writes evil:LinterRulesetScore with the active rulesetId', async () => {
    const result = await lintBpmnXmlOnDisk(DAEMON_ENGINE_XML, DISK_OPTIONS);
    assert.strictEqual(result.status, 'updated');
    if (result.status === 'skipped-foreign') {
      throw new Error('expected updated xml');
    }
    assert.match(result.xml, /rulesetId="bpmn-development"/);
    assert.match(result.xml, /linterRulesetScore/i);
    assert.match(result.xml, /scorePercent="/);
  });

  it('skips foreign diagrams unless alwaysLintForeignDiagrams is set', async () => {
    const skipped = await lintBpmnXmlOnDisk(CAMUNDA_FOREIGN_XML, DISK_OPTIONS);
    assert.strictEqual(skipped.status, 'skipped-foreign');

    const allowed = await lintBpmnXmlOnDisk(CAMUNDA_FOREIGN_XML, {
      ...DISK_OPTIONS,
      alwaysLintForeignDiagrams: true,
    });
    assert.strictEqual(allowed.status, 'updated');
    if (allowed.status === 'skipped-foreign') {
      throw new Error('expected updated xml');
    }
    assert.match(allowed.xml, /rulesetId="bpmn-development"/);
  });

  it('returns unchanged when the persisted score already matches', async () => {
    const first = await lintBpmnXmlOnDisk(DAEMON_ENGINE_XML, DISK_OPTIONS);
    assert.strictEqual(first.status, 'updated');
    if (first.status === 'skipped-foreign') {
      throw new Error('expected updated xml');
    }
    const second = await lintBpmnXmlOnDisk(first.xml, DISK_OPTIONS);
    assert.strictEqual(second.status, 'unchanged');
  });

  it('scores a pool+lane diagram with the same denominator as the live canvas (not the full moddle tree)', async () => {
    const definitions = await parseBpmnDefinitionsFromXml(POOL_LANE_XML);
    const registry = buildModdleElementRegistry(definitions);
    const ids = registry
      .getAll()
      .map((element) => (element as { id: string }).id)
      .sort();

    assert.strictEqual(registry.rootElementId, 'Collaboration_1');
    assert.deepStrictEqual(ids, CANVAS_LIKE_POOL_LANE_IDS);
    assert.ok(!ids.includes('Collaboration_1'));
    assert.ok(!ids.includes('Process_1'));
    assert.ok(!ids.includes('LaneSet_1'));
    assert.ok(!ids.includes('Definitions_CaCascadeParentThenAbort'));
    assert.strictEqual(countScorableElements(registry, registry.rootElementId), 7);

    const result = await lintBpmnXmlOnDisk(POOL_LANE_XML, DISK_OPTIONS);
    assert.strictEqual(result.status, 'updated');
    if (result.status === 'skipped-foreign') {
      throw new Error('expected updated xml');
    }
    assert.match(result.xml, /maxPoints="7"/);
  });

  it('falls back to flow nodes when the file has no DI and still excludes the process as canvas root', async () => {
    const definitions = await parseBpmnDefinitionsFromXml(DAEMON_ENGINE_XML);
    const registry = buildModdleElementRegistry(definitions);
    const ids = registry
      .getAll()
      .map((element) => (element as { id: string }).id)
      .sort();

    assert.strictEqual(registry.rootElementId, 'process_1');
    assert.deepStrictEqual(ids, ['End_1', 'Flow_1', 'Flow_2', 'Start_1', 'Task_1']);
    assert.strictEqual(countScorableElements(registry, registry.rootElementId), 5);
  });
});
