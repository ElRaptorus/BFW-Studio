import assert from 'node:assert';
import { describe, it } from 'vitest';

import { computeLintScore } from '../../../src/modules/bpmn-linter/scoring/computeLintScore';
import type { LintFinding } from '../../../src/modules/bpmn-linter/types';

function makeFinding(partial: Partial<LintFinding> & Pick<LintFinding, 'severity' | 'elementId'>): LintFinding {
  return {
    ruleId: 'r',
    elementName: null,
    message: 'm',
    why: '',
    suggestion: '',
    category: 'structure',
    ...partial,
  };
}

function registryFromShapes(shapes: { id: string; type?: string; $type?: string }[]) {
  const map = new Map(
    shapes.map((shape) => [
      shape.id,
      { id: shape.id, type: shape.type, businessObject: { $type: shape.$type ?? 'bpmn:Task' } },
    ]),
  );
  return {
    getAll: () => [...map.values()],
    get: (id: string) => map.get(id),
  };
}

describe('computeLintScore', () => {
  const policyStrict = {
    validMinPercent: 95,
    riskyMinPercent: 80,
    instantFailOnAnyError: true,
    instantRiskOnAnyWarning: false,
  };

  it('100 elements, 5 distinct error elements → 95%', () => {
    const shapes = Array.from({ length: 100 }, (_, i) => ({ id: `T${i}`, $type: 'bpmn:Task' }));
    const reg = registryFromShapes(shapes);
    const findings: LintFinding[] = [0, 1, 2, 3, 4].map((i) =>
      makeFinding({ severity: 'error', elementId: `T${i}`, ruleId: `rule-${i}` }),
    );
    const result = computeLintScore({
      findings,
      elementRegistry: reg,
      rootElementId: 'root',
      scorePolicy: policyStrict,
    });
    assert.strictEqual(result.maxPoints, 100);
    assert.strictEqual(result.penaltyPoints, 5);
    assert.strictEqual(result.scorePercent, 95);
    assert.strictEqual(result.complianceStatus, 'failed');
    assert.ok(result.reasonCodes.includes('instant_fail_any_error'));
  });

  it('multiple errors on one element cost 1 point', () => {
    const reg = registryFromShapes([{ id: 'A', $type: 'bpmn:Task' }]);
    const findings = [
      makeFinding({ severity: 'error', elementId: 'A', ruleId: 'r1' }),
      makeFinding({ severity: 'error', elementId: 'A', ruleId: 'r2' }),
    ];
    const result = computeLintScore({ findings, elementRegistry: reg, rootElementId: 'root', scorePolicy: {} });
    assert.strictEqual(result.maxPoints, 1);
    assert.strictEqual(result.penaltyPoints, 1);
    assert.strictEqual(result.scorePercent, 0);
  });

  it('warning only on element → 0.5 penalty', () => {
    const reg = registryFromShapes([
      { id: 'A', $type: 'bpmn:Task' },
      { id: 'B', $type: 'bpmn:Task' },
    ]);
    const findings = [makeFinding({ severity: 'warning', elementId: 'A', ruleId: 'w1' })];
    const result = computeLintScore({ findings, elementRegistry: reg, rootElementId: 'root', scorePolicy: {} });
    assert.strictEqual(result.maxPoints, 2);
    assert.strictEqual(result.penaltyPoints, 0.5);
    assert.strictEqual(result.remainingPoints, 1.5);
  });

  it('ignores info findings for scoring', () => {
    const reg = registryFromShapes([{ id: 'A', $type: 'bpmn:Task' }]);
    const findings = [makeFinding({ severity: 'info', elementId: 'A', ruleId: 'i1' })];
    const result = computeLintScore({ findings, elementRegistry: reg, rootElementId: 'root', scorePolicy: {} });
    assert.strictEqual(result.penaltyPoints, 0);
    assert.strictEqual(result.scorePercent, 100);
  });

  it('__diagram__ bucket adds maxPoints +1 when used', () => {
    const reg = registryFromShapes([{ id: 'A', $type: 'bpmn:Task' }]);
    const findings = [makeFinding({ severity: 'error', elementId: null, ruleId: 'p' })];
    const result = computeLintScore({ findings, elementRegistry: reg, rootElementId: 'root', scorePolicy: {} });
    assert.strictEqual(result.usesDiagramBucket, true);
    assert.strictEqual(result.maxPoints, 2);
    assert.strictEqual(result.penaltyPoints, 1);
  });

  it('unknown element id maps to __diagram__', () => {
    const reg = registryFromShapes([{ id: 'A', $type: 'bpmn:Task' }]);
    const findings = [makeFinding({ severity: 'warning', elementId: 'missing', ruleId: 'w' })];
    const result = computeLintScore({ findings, elementRegistry: reg, rootElementId: 'root', scorePolicy: {} });
    assert.strictEqual(result.usesDiagramBucket, true);
    assert.strictEqual(result.maxPoints, 2);
    assert.strictEqual(result.penaltyPoints, 0.5);
  });

  it('instant risk when warnings and no errors', () => {
    const reg = registryFromShapes([{ id: 'A', $type: 'bpmn:Task' }]);
    const findings = [makeFinding({ severity: 'warning', elementId: 'A', ruleId: 'w' })];
    const result = computeLintScore({
      findings,
      elementRegistry: reg,
      rootElementId: 'root',
      scorePolicy: {
        instantRiskOnAnyWarning: true,
        instantFailOnAnyError: false,
        validMinPercent: 100,
        riskyMinPercent: 0,
      },
    });
    assert.strictEqual(result.complianceStatus, 'risky');
    assert.ok(result.reasonCodes.includes('instant_risk_any_warning'));
  });

  it('score is 0% when every bucket is an error', () => {
    const reg = registryFromShapes([{ id: 'A', $type: 'bpmn:Task' }]);
    const findings = [
      makeFinding({ severity: 'error', elementId: 'A', ruleId: 'e1' }),
      makeFinding({ severity: 'error', elementId: null, ruleId: 'e2' }),
    ];
    const result = computeLintScore({ findings, elementRegistry: reg, rootElementId: 'root', scorePolicy: {} });
    assert.strictEqual(result.maxPoints, 2);
    assert.strictEqual(result.penaltyPoints, 2);
    assert.strictEqual(result.scorePercent, 0);
  });
});
