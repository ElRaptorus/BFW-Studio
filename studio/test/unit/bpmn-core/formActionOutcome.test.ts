import { FormActionPreset } from '#modules/bpmn-core/form-renderer/FormModel';
import type { FormAction, FormActionEffect } from '#modules/bpmn-core/form-renderer/FormModel';
import { isRenderableFormAction, resolveFormActionOutcome } from '#modules/bpmn-core/form-renderer/formActionOutcome';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function action(effect: FormActionEffect, overrides: Partial<FormAction> = {}): FormAction {
  return {
    id: 'approve',
    label: 'Approve',
    preset: FormActionPreset.Custom,
    effect,
    ...overrides,
  };
}

describe('form action outcome', () => {
  it('submit validates and returns the action id and the field values', () => {
    let validated = false;
    const outcome = resolveFormActionOutcome(
      action('submit'),
      () => {
        validated = true;
        return {};
      },
      () => ({ approved: true }),
    );

    assert.equal(validated, true);
    assert.deepEqual(outcome, { kind: 'submit', actionId: 'approve', values: { approved: true } });
  });

  it('abort returns the action id', () => {
    const outcome = resolveFormActionOutcome(
      action('abort'),
      () => ({}),
      () => ({}),
    );
    assert.deepEqual(outcome, { kind: 'abort', actionId: 'approve' });
  });

  it('submit with skipsValidation returns values despite a failing validator', () => {
    const outcome = resolveFormActionOutcome(
      action('submit', { skipsValidation: true }),
      () => ({ name: 'Name is required' }),
      () => ({ name: '' }),
    );
    assert.deepEqual(outcome, { kind: 'submit', actionId: 'approve', values: { name: '' } });
  });

  it('invalid returns the errors', () => {
    const outcome = resolveFormActionOutcome(
      action('submit'),
      () => ({ name: 'Name is required' }),
      () => ({ name: 'collected' }),
    );
    assert.deepEqual(outcome, { kind: 'invalid', errors: { name: 'Name is required' } });
  });

  it('dismiss and abort call neither validate nor collect', () => {
    const fail = (): never => {
      throw new Error('must not be called');
    };

    assert.deepEqual(resolveFormActionOutcome(action('dismiss'), fail, fail), { kind: 'dismiss' });
    assert.deepEqual(resolveFormActionOutcome(action('abort', { skipsValidation: true }), fail, fail), {
      kind: 'abort',
      actionId: 'approve',
    });
  });

  it('missing or unknown effect is not renderable', () => {
    assert.equal(isRenderableFormAction({ effect: 'submit' }), true);
    assert.equal(isRenderableFormAction({ effect: 'dismiss' }), true);
    assert.equal(isRenderableFormAction({ effect: 'abort' }), true);
    assert.equal(isRenderableFormAction({}), false);
    assert.equal(isRenderableFormAction({ effect: 'cancel' }), false);
    assert.equal(isRenderableFormAction({ effect: true }), false);
  });
});
