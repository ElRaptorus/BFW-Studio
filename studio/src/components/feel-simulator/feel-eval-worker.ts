import { evaluate } from '@bpmn-io/feelin';

self.onmessage = (event: MessageEvent): void => {
  const { expression, context } = event.data;
  const t0 = performance.now();
  try {
    const { value, warnings } = evaluate(expression, context);
    const elapsed = performance.now() - t0;
    self.postMessage({
      status: 'success',
      value: serializeValue(value),
      warnings,
      elapsed,
    });
  } catch (err: unknown) {
    const elapsed = performance.now() - t0;
    self.postMessage({
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      elapsed,
    });
  }
};

/**
 * Converts feelin result values into JSON-safe primitives that survive
 * postMessage's structured clone algorithm. Luxon DateTime/Duration objects,
 * feelin Range instances, and FunctionWrapper instances are all non-cloneable.
 */
function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // Luxon DateTime — has toISO() and year
    if ('toISO' in obj && 'year' in obj) {
      return (obj as { toISO: () => string }).toISO();
    }
    // Luxon Duration — has toISO() and values
    if ('toISO' in obj && 'values' in obj) {
      return (obj as { toISO: () => string }).toISO();
    }
    // feelin Range
    if ('start included' in obj && 'end included' in obj) {
      return {
        start: obj.start,
        end: obj.end,
        'start included': obj['start included'],
        'end included': obj['end included'],
      };
    }
    // feelin FunctionWrapper
    if ('fn' in obj && 'parameterNames' in obj) {
      return '<function>';
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = serializeValue(val);
    }
    return result;
  }

  return String(value);
}
