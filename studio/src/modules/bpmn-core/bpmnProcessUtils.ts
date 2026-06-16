/**
 * Extracts the process name from a BPMN XML string by looking for the
 * `name` attribute on the first `<bpmn:process>` element.
 *
 * Returns `null` if the name cannot be found.
 */
export function extractProcessName(xml: string): string | null {
  const nameMatch = xml.match(/<bpmn:process[^>]+name="([^"]+)"/);
  return nameMatch?.[1] ?? null;
}

/**
 * Converts a human-readable name into a URL/branch-safe slug:
 * lowercase, non-alphanumeric runs replaced with hyphens, trimmed.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
