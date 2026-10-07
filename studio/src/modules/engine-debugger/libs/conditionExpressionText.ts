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
