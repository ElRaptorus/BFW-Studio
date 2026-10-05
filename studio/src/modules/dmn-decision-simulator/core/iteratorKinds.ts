import type { DmnBoxedEvery, DmnBoxedSome, DmnDefinitions } from '@elraptorus/bfw_engine_sdk';

type IteratorKind = 'every' | 'some';

const kindsByDefinitions = new WeakMap<DmnDefinitions, Map<string, IteratorKind>>();

const ITERATOR_ELEMENT = /<(?:[\w.-]+:)?(every|some)\b([^>]*)>/g;
const IDENTIFIER_ATTRIBUTE = /\bid\s*=\s*["']([^"']+)["']/;

/**
 * The parsed model represents `<every>` and `<some>` with the same shape (`satisfiesExpression`), so the element
 * kind is recovered from the raw XML by element id. An iterator without an id defaults to `every`.
 */
export function iteratorKindOf(definitions: DmnDefinitions, body: DmnBoxedEvery | DmnBoxedSome): IteratorKind {
  let kinds = kindsByDefinitions.get(definitions);
  if (kinds == null) {
    kinds = new Map();
    for (const match of definitions.rawXml.matchAll(ITERATOR_ELEMENT)) {
      const identifier = IDENTIFIER_ATTRIBUTE.exec(match[2])?.[1];
      if (identifier != null) {
        kinds.set(identifier, match[1] as IteratorKind);
      }
    }
    kindsByDefinitions.set(definitions, kinds);
  }
  return (body.id != null ? kinds.get(body.id) : undefined) ?? 'every';
}
