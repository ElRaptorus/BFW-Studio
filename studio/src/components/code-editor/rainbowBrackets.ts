import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

const OPENING_BRACKETS = '([{';
const CLOSING_BRACKETS = ')]}';
const MATCHING_CLOSE: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

const BRACKET_MARKS = [0, 1, 2, 3, 4, 5].map((index) => Decoration.mark({ class: `cm-rainbow-bracket-${index}` }));

function isStringOrCommentName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('string') || lower.includes('comment');
}

function buildFromTree(view: EditorView): DecorationSet | null {
  const tree = syntaxTree(view.state);
  if (tree.length === 0) {
    return null;
  }

  const builder = new RangeSetBuilder<Decoration>();
  const viewportFrom = view.viewport.from;
  const viewportTo = view.viewport.to;
  let depth = 0;
  let added = 0;

  tree.iterate({
    from: 0,
    to: viewportTo,
    enter(node) {
      if (isStringOrCommentName(node.name)) {
        return false;
      }
      if (node.to - node.from !== 1) {
        return true;
      }
      const character = view.state.doc.sliceString(node.from, node.to);
      const isOpen = OPENING_BRACKETS.includes(character);
      const isClose = CLOSING_BRACKETS.includes(character);
      if (!isOpen && !isClose) {
        return true;
      }
      const inViewport = node.from >= viewportFrom;
      if (isOpen) {
        if (inViewport) {
          builder.add(node.from, node.to, BRACKET_MARKS[depth % 6]);
          added += 1;
        }
        depth += 1;
        return true;
      }
      depth = Math.max(0, depth - 1);
      if (inViewport) {
        builder.add(node.from, node.to, BRACKET_MARKS[depth % 6]);
        added += 1;
      }
      return true;
    },
  });

  if (added === 0) {
    return null;
  }
  return builder.finish();
}

function isInsideStringOrComment(view: EditorView, position: number): boolean {
  const current = syntaxTree(view.state).resolveInner(position, 1);
  for (let node: typeof current | null = current; node; node = node.parent) {
    if (isStringOrCommentName(node.name)) {
      return true;
    }
  }
  return false;
}

function buildFromScan(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const document = view.state.doc;
  const viewportFrom = view.viewport.from;
  const viewportTo = view.viewport.to;
  const stack: string[] = [];
  let depth = 0;

  for (let index = 0; index < viewportTo; index++) {
    const character = document.sliceString(index, index + 1);
    const isOpen = OPENING_BRACKETS.includes(character);
    const isClose = CLOSING_BRACKETS.includes(character);
    if (!isOpen && !isClose) {
      continue;
    }
    if (isInsideStringOrComment(view, index)) {
      continue;
    }
    const inViewport = index >= viewportFrom;
    if (isOpen) {
      if (inViewport) {
        builder.add(index, index + 1, BRACKET_MARKS[depth % 6]);
      }
      stack.push(character);
      depth += 1;
      continue;
    }
    if (stack.length > 0 && MATCHING_CLOSE[stack[stack.length - 1]] === character) {
      stack.pop();
      depth = Math.max(0, depth - 1);
      if (inViewport) {
        builder.add(index, index + 1, BRACKET_MARKS[depth % 6]);
      }
    }
  }

  return builder.finish();
}

function buildDecorations(view: EditorView): DecorationSet {
  return buildFromTree(view) ?? buildFromScan(view);
}

export function rainbowBrackets() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
