import type { FormAction } from '#modules/bpmn-core/form-renderer/FormModel';

const FORM_ACTION_EFFECTS = ['submit', 'dismiss', 'abort'] as const;

export type FormActionOutcome =
  | { kind: 'submit'; actionId: string; values: Record<string, unknown> }
  | { kind: 'invalid'; errors: Record<string, string> }
  | { kind: 'dismiss' }
  | { kind: 'abort'; actionId: string };

export function isRenderableFormAction(action: { effect?: unknown }): boolean {
  return FORM_ACTION_EFFECTS.some((effect) => effect === action.effect);
}

export function resolveFormActionOutcome(
  action: FormAction,
  validate: () => Record<string, string>,
  collect: () => Record<string, unknown>,
): FormActionOutcome {
  if (action.effect === 'dismiss') {
    return { kind: 'dismiss' };
  }

  if (action.effect === 'abort') {
    return { kind: 'abort', actionId: action.id };
  }

  if (action.skipsValidation !== true) {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      return { kind: 'invalid', errors };
    }
  }

  return { kind: 'submit', actionId: action.id, values: collect() };
}
