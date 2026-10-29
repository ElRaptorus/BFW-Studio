import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

/** The location of a value inside a JSON document: property names and array indices from the root. */
export type JsonPath = (string | number)[];

/**
 * What a position in the document stands for.
 * - `slot: 'key'` — a property name of the object at `path`; `key` is the name written so far.
 * - `slot: 'value'` — the value at `path`.
 *
 * `from` / `to` cover the token at the position, opening and closing quotes included; they are equal in whitespace.
 */
export type JsonPathLocation = {
  path: JsonPath;
  slot: 'key' | 'value';
  key: string | null;
  from: number;
  to: number;
  existingKeys: string[];
};

type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>;

// The JSON grammar has `JsonText` as root and comma nodes; the JSON5 grammar has `File`, `PropertyColon` and comments.
const VALUE_NODES = new Set(['Object', 'Array', 'String', 'Number', 'True', 'False', 'Null']);
const STRING_NODES = new Set(['PropertyName', 'String']);
const COMMENT_NODES = new Set(['LineComment', 'BlockComment']);
const COLON_NODES = new Set([':', 'PropertyColon']);
const QUOTES = new Set(['"', "'"]);

function unquote(text: string): string {
  const first = text[0];
  if (!QUOTES.has(first)) {
    return text;
  }
  const closed = text.length > 1 && text[text.length - 1] === first;
  const inner = text.slice(1, closed ? -1 : undefined);
  if (first === '"' && closed) {
    try {
      return JSON.parse(text);
    } catch {
      return inner;
    }
  }
  return inner;
}

function childrenOf(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = [];
  for (let child = node.firstChild; child != null; child = child.nextSibling) {
    children.push(child);
  }
  return children;
}

function propertyKeyOf(state: EditorState, property: SyntaxNode): string | null {
  const name = property.getChild('PropertyName');
  return name == null ? null : unquote(state.sliceDoc(name.from, name.to));
}

function colonOf(property: SyntaxNode): SyntaxNode | undefined {
  return childrenOf(property).find((child) => COLON_NODES.has(child.name));
}

function propertyValueOf(property: SyntaxNode): SyntaxNode | undefined {
  const colon = colonOf(property);
  return colon == null
    ? undefined
    : childrenOf(property).find((child) => child.from >= colon.to && VALUE_NODES.has(child.name));
}

function valueChildrenOf(array: SyntaxNode): SyntaxNode[] {
  return childrenOf(array).filter(
    (child) => VALUE_NODES.has(child.name) || (child.name === '⚠' && child.to > child.from),
  );
}

/** The path of the value that `node` is, read from its ancestors. */
function pathOf(state: EditorState, node: SyntaxNode): JsonPath {
  const path: JsonPath = [];
  for (let current = node; current.parent != null; current = current.parent) {
    const parent = current.parent;
    if (parent.name === 'Property') {
      const key = propertyKeyOf(state, parent);
      if (key != null) {
        path.unshift(key);
      }
    } else if (parent.name === 'Array') {
      path.unshift(valueChildrenOf(parent).filter((child) => child.to <= current.from).length);
    }
  }
  return path;
}

function existingKeysOf(state: EditorState, object: SyntaxNode, from: number, to: number): string[] {
  return object
    .getChildren('Property')
    .filter((property) => property.to <= from || property.from >= to)
    .map((property) => propertyKeyOf(state, property))
    .filter((key): key is string => key != null);
}

function isWordCharacter(character: string): boolean {
  return character !== '' && !/[\s"',:{}[\]]/.test(character);
}

function isTerminatedString(state: EditorState, node: SyntaxNode): boolean {
  const text = state.sliceDoc(node.from, node.to);
  return STRING_NODES.has(node.name) && QUOTES.has(text[0]) && text.length > 1 && text[text.length - 1] === text[0];
}

/**
 * The token at the position. Error recovery splits unterminated strings (JSON5 reads `"bpmn.ed` as `⚠ bpmn . ed`),
 * so anything but a terminated string is read from the text: the word around the position plus its quotes.
 */
function tokenAt(state: EditorState, pos: number, side: -1 | 1): { from: number; to: number } {
  const node = syntaxTree(state).resolveInner(pos, side);
  if (isTerminatedString(state, node) && node.from <= pos && pos <= node.to) {
    return { from: node.from, to: node.to };
  }
  let from = pos;
  let to = pos;
  while (isWordCharacter(state.sliceDoc(from - 1, from))) {
    from--;
  }
  while (isWordCharacter(state.sliceDoc(to, to + 1))) {
    to++;
  }
  const quote = state.sliceDoc(from - 1, from);
  if (QUOTES.has(quote)) {
    from--;
    if (state.sliceDoc(to, to + 1) === quote) {
      to++;
    }
  }
  return { from, to };
}

/** What the position stands for; `side` picks the token before (-1) or after (1) the position, as in `resolveInner`. */
export function jsonPathAt(state: EditorState, pos: number, side: -1 | 1 = -1): JsonPathLocation | null {
  const tree = syntaxTree(state);
  if (COMMENT_NODES.has(tree.resolveInner(pos, side).name)) {
    return null;
  }
  const { from, to } = tokenAt(state, pos, side);
  const location = (path: JsonPath, slot: 'key' | 'value', existingKeys: string[] = []): JsonPathLocation => ({
    path,
    slot,
    key: slot === 'key' && to > from ? unquote(state.sliceDoc(from, to)) : null,
    from,
    to,
    existingKeys,
  });

  const container = findContainer(tree.resolveInner(from, -1));
  if (container == null) {
    return location([], 'value');
  }
  if (container.name === 'Property') {
    const colon = colonOf(container);
    const key = propertyKeyOf(state, container);
    if (colon != null && from >= colon.to && key != null) {
      return location([...pathOf(state, container), key], 'value');
    }
    const object = container.parent!;
    return location(pathOf(state, object), 'key', existingKeysOf(state, object, from, Math.max(to, container.to)));
  }
  if (container.name === 'Array') {
    const index = valueChildrenOf(container).filter((child) => child.to <= from).length;
    return location([...pathOf(state, container), index], 'value');
  }
  // In an object: right after `"key":` without a value the position is that property's value.
  const before = container.childBefore(from);
  if (before?.name === 'Property' && colonOf(before) != null && propertyValueOf(before) == null) {
    const key = propertyKeyOf(state, before);
    if (key != null) {
      return location([...pathOf(state, container), key], 'value');
    }
  }
  return location(pathOf(state, container), 'key', existingKeysOf(state, container, from, to));
}

function findContainer(node: SyntaxNode): SyntaxNode | null {
  for (let current: SyntaxNode | null = node; current != null; current = current.parent) {
    if (current.name === 'Object' || current.name === 'Array' || current.name === 'Property') {
      return current;
    }
  }
  return null;
}

/**
 * The range of the value at `path`, or of its property name with `target: 'key'`. A path that leads nowhere ends at
 * the deepest value that exists.
 */
export function jsonRangeOf(
  state: EditorState,
  path: JsonPath,
  target: 'key' | 'value' = 'value',
): { from: number; to: number } | null {
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state);
  let node = childrenOf(tree.topNode).find((child) => VALUE_NODES.has(child.name));
  if (node == null) {
    return null;
  }
  for (let index = 0; index < path.length; index++) {
    const segment = path[index];
    const isLast = index === path.length - 1;
    let next: SyntaxNode | undefined;
    if (node.name === 'Object' && typeof segment === 'string') {
      // Parsers keep the last of duplicate keys, so the last one is the value that was validated.
      const property = node
        .getChildren('Property')
        .findLast((candidate) => propertyKeyOf(state, candidate) === segment);
      if (property != null && isLast && target === 'key') {
        const name = property.getChild('PropertyName')!;
        return { from: name.from, to: name.to };
      }
      next = property == null ? undefined : (propertyValueOf(property) ?? property);
    } else if (node.name === 'Array' && typeof segment === 'number') {
      next = valueChildrenOf(node)[segment];
    }
    if (next == null || next.name === 'Property') {
      return { from: (next ?? node).from, to: (next ?? node).to };
    }
    node = next;
  }
  return { from: node.from, to: node.to };
}
