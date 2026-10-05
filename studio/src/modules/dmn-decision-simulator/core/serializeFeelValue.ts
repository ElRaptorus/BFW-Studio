import { isFunction, isRange } from '@bpmn-io/feelin';

/**
 * Converts feelin values (temporal wrappers, ranges, functions) into JSON-safe data that survives
 * `postMessage` and renders in the result view. Plain data passes through unchanged.
 */
export function serializeFeelValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(serializeFeelValue);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  if (isFunction(value)) {
    return '<function>';
  }
  if (isRange(value)) {
    return {
      start: serializeFeelValue(value.start),
      end: serializeFeelValue(value.end),
      'start included': value['start included'],
      'end included': value['end included'],
    };
  }
  const withJson = value as { toJSON?: unknown };
  if (typeof withJson.toJSON === 'function' && Object.getPrototypeOf(value) !== Object.prototype) {
    return serializeFeelValue((withJson.toJSON as () => unknown).call(value));
  }
  // Like JSON, drop properties whose value is undefined instead of turning them into null.
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, serializeFeelValue(entry)]),
  );
}

/** Compact, human-readable rendering of a value for error messages. */
export function describeValue(value: unknown): string {
  return JSON.stringify(serializeFeelValue(value)) ?? 'null';
}
