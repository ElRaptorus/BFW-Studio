import type { BpmnDiagramOrigin, ModdleDefinitions } from './types';

/**
 * Inspects the moddle definitions tree to classify the diagram's platform
 * origin. Foreign namespaces (Camunda, Zeebe, Flowable, Activiti) end up in
 * `$attrs` because they are unknown to the bfw-platform moddle extension.
 * BFW-Engine diagrams are identified by `bfw:*` extension elements or
 * by the exporter field written by Bifrost Forge World.
 *
 * `unknown` is treated the same as `foreign` for linting purposes — the
 * linter should not assume a diagram belongs to the Engine without
 * positive evidence.
 */
export function detectBpmnOrigin(definitions: ModdleDefinitions): BpmnDiagramOrigin {
  const extValues = (definitions as Record<string, unknown>).extensionElements as { values?: unknown[] } | undefined;
  if (Array.isArray(extValues?.values)) {
    for (const val of extValues!.values) {
      if (
        typeof (val as { $type?: string })?.$type === 'string' &&
        (val as { $type: string }).$type.startsWith('bfw:')
      ) {
        return { origin: 'bfw-engine', provider: 'BFW-Engine' };
      }
    }
  }

  const exporter = (definitions as Record<string, unknown>).exporter;
  if (typeof exporter === 'string') {
    const lower = exporter.toLowerCase();
    if (lower.includes('bifrost') || lower.includes('forge world')) {
      return { origin: 'bfw-engine', provider: 'BFW-Engine' };
    }
  }

  const attrs = (definitions as Record<string, unknown>).$attrs as Record<string, string> | undefined;
  if (attrs) {
    for (const key of Object.keys(attrs)) {
      if (key === 'xmlns:camunda') {
        return { origin: 'foreign', provider: 'Camunda' };
      }
      if (key === 'xmlns:zeebe') {
        return { origin: 'foreign', provider: 'Zeebe / Camunda 8' };
      }
      if (key === 'xmlns:flowable') {
        return { origin: 'foreign', provider: 'Flowable' };
      }
      if (key === 'xmlns:activiti') {
        return { origin: 'foreign', provider: 'Activiti' };
      }
    }
  }

  if (typeof exporter === 'string') {
    const lower = exporter.toLowerCase();
    if (lower.includes('camunda')) {
      return { origin: 'foreign', provider: 'Camunda' };
    }
  }

  return { origin: 'unknown', provider: 'Unknown' };
}
