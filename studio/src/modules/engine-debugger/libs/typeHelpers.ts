export function undefinedIfNull<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

export function emptyIfNull(value: string | null | undefined): string {
  return value ?? '';
}

export function getConditionExpressionText(
  conditionExpression: string | { expression?: string | null } | null | undefined,
): string | undefined {
  if (conditionExpression == null) {
    return undefined;
  }
  if (typeof conditionExpression === 'string') {
    return conditionExpression;
  }
  return conditionExpression.expression ?? undefined;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
