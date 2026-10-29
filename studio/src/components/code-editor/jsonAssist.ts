import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { json, jsonLanguage } from '@codemirror/lang-json';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { type Action, type Diagnostic, linter } from '@codemirror/lint';
import { type EditorState, type Extension, StateEffect, StateField } from '@codemirror/state';
import { type EditorView, hoverTooltip, type ViewUpdate } from '@codemirror/view';
import { json5, json5Language, json5ParseLinter } from 'codemirror-json5';
import * as jsonComment from 'comment-json';
import DOMPurify from 'dompurify';
import * as JSON5 from 'json5';
import { marked } from 'marked';

import { jsonParseLinterExtension } from './jsonParseLinter';
import { type JsonPath, type JsonPathLocation, jsonPathAt, jsonRangeOf } from './jsonSyntaxPaths';

/** A finding at `path`; `target: 'key'` marks the property name instead of the value. */
export type JsonAssistDiagnostic = {
  path: JsonPath;
  message: string;
  severity: 'error' | 'warning';
  target?: 'key' | 'value';
  deprecated?: boolean;
};

/** `label` is the bare key or value as shown in the list; `insertText` replaces the token, quotes included. */
export type JsonAssistCompletion = { label: string; insertText: string; detail?: string; info?: string };

/** Supplies the document-specific knowledge for lint, completion and hover. */
export interface JsonAssistBackend {
  validate(value: unknown): JsonAssistDiagnostic[];
  /** Markdown shown on hover. */
  describe?(path: JsonPath): string | null;
  complete?(location: JsonPathLocation): JsonAssistCompletion[];
}

const setBackend = StateEffect.define<JsonAssistBackend>();

const QUOTES = new Set(['"', "'"]);

const JSON_NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

const JSON5_ONLY_TOKENS = new Set(['PropertyName', 'String', 'Number']);

function replaceWith(name: string, insert: string): Action[] {
  return [{ name, apply: (view, from, to) => view.dispatch({ changes: { from, to, insert } }) }];
}

/** Only called on tokens of a document `JSON5.parse` accepted, so parsing a token cannot throw. */
function jsoncTokenFinding(node: string, text: string): Pick<Diagnostic, 'message' | 'actions'> | null {
  if (node === 'PropertyName' && !text.startsWith('"')) {
    const key = Object.keys(JSON5.parse<object>(`{${text}:0}`))[0];
    return {
      message: 'Property names need double quotes.',
      actions: replaceWith('Use double quotes', JSON.stringify(key)),
    };
  }
  if (node === 'String' && text.startsWith("'")) {
    return {
      message: 'Strings need double quotes.',
      actions: replaceWith('Use double quotes', JSON.stringify(JSON5.parse(text))),
    };
  }
  if (node === 'Number' && !JSON_NUMBER.test(text)) {
    const value = JSON5.parse<number>(text);
    return {
      message: 'Not a JSON number.',
      actions: Number.isFinite(value) ? replaceWith('Convert to JSON number', JSON.stringify(value)) : [],
    };
  }
  return null;
}

function saveParserError(state: EditorState): Diagnostic | null {
  try {
    jsonComment.parse(state.doc.toString());
    return null;
  } catch (error) {
    const { message, line } = error as SyntaxError & { line?: number };
    const reported = line ?? Number(/line (\d+)/.exec(message)?.[1] ?? 1);
    const { from, to } = state.doc.line(Math.min(Math.max(reported, 1), state.doc.lines));
    return { from, to, severity: 'error', message };
  }
}

/**
 * What `comment-json` (the Settings save parser) rejects in a document `JSON5.parse` accepted.
 * The JSON5 grammar breaks on some string escapes (also the JSON-valid `\u` and `\/`), so
 * token findings are only trusted on an error-free tree; the save parser covers the rest.
 */
function jsoncDiagnostics(state: EditorState): Diagnostic[] {
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state);
  const tokens: { name: string; from: number; to: number }[] = [];
  let broken = false;
  tree.iterate({
    enter: (node) => {
      broken ||= node.type.isError;
      if (JSON5_ONLY_TOKENS.has(node.name)) {
        tokens.push({ name: node.name, from: node.from, to: node.to });
      }
    },
  });
  const findings = broken
    ? []
    : tokens.flatMap(({ name, from, to }) => {
        const finding = jsoncTokenFinding(name, state.sliceDoc(from, to));
        return finding == null ? [] : [{ from, to, severity: 'error' as const, ...finding }];
      });
  if (findings.length > 0) {
    return findings;
  }
  const saveError = saveParserError(state);
  return saveError == null ? [] : [saveError];
}

function refreshOnBackendChange(update: ViewUpdate): boolean {
  return update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(setBackend)));
}

function diagnosticsOf(state: EditorState, backend: JsonAssistBackend, value: unknown): Diagnostic[] {
  return backend.validate(value).map((finding) => {
    const range = jsonRangeOf(state, finding.path, finding.target) ?? { from: 0, to: 0 };
    return {
      ...range,
      severity: finding.severity,
      message: finding.message,
      markClass: finding.deprecated ? 'cm-json-assist-deprecated' : undefined,
    };
  });
}

function toCompletion(completion: JsonAssistCompletion, location: JsonPathLocation): Completion {
  return {
    label: completion.label,
    detail: completion.detail,
    info: completion.info,
    apply: (view, _completion, from, to) => {
      const token = jsonPathAt(view.state, to) ?? { from, to };
      const following = view.state.doc.sliceString(token.to, token.to + 200).trimStart();
      let insert = completion.insertText;
      if (location.slot === 'key' && following.startsWith(':')) {
        insert = JSON.stringify(completion.label);
      } else if (location.slot === 'key' && following !== '' && !/^[,}\]/]/.test(following)) {
        insert += ',';
      }
      view.dispatch({
        changes: { from: token.from, to: token.to, insert },
        selection: { anchor: token.from + insert.length },
      });
    },
  };
}

function completionSource(field: StateField<JsonAssistBackend>) {
  return (context: CompletionContext): CompletionResult | null => {
    const backend = context.state.field(field);
    const location = jsonPathAt(context.state, context.pos);
    if (backend.complete == null || location == null || (location.from === location.to && !context.explicit)) {
      return null;
    }
    const options = backend.complete(location).map((completion) => toCompletion(completion, location));
    if (options.length === 0) {
      return null;
    }
    const quoted = QUOTES.has(context.state.sliceDoc(location.from, location.from + 1));
    return { from: quoted ? location.from + 1 : location.from, options, validFor: /^[^\s"',:{}[\]]*$/ };
  };
}

function hoverSource(field: StateField<JsonAssistBackend>) {
  return hoverTooltip((view, pos, side) => {
    const backend = view.state.field(field);
    const location = jsonPathAt(view.state, pos, side);
    const hovered = side < 0 ? pos - 1 : pos;
    if (backend.describe == null || location == null || hovered < location.from || hovered >= location.to) {
      return null;
    }
    if (location.slot === 'key' && location.key == null) {
      return null;
    }
    const markdown = backend.describe(location.slot === 'key' ? [...location.path, location.key!] : location.path);
    if (markdown == null || markdown === '') {
      return null;
    }
    return {
      pos: location.from,
      end: location.to,
      above: true,
      create: () => {
        const dom = document.createElement('div');
        dom.className = 'cm-json-assist-hover';
        dom.innerHTML = DOMPurify.sanitize(marked.parse(markdown, { async: false }));
        return { dom };
      },
    };
  });
}

/**
 * Lint, completion and hover for a JSON or JSONC document, driven by `backend`.
 * `jsonc` (comments, trailing commas) accepts exactly what `comment-json` parses.
 */
export function createJsonAssistExtensions(dialect: 'json' | 'jsonc', backend: JsonAssistBackend): Extension[] {
  const field = StateField.define<JsonAssistBackend>({
    create: () => backend,
    update: (value, transaction) =>
      transaction.effects.reduce((current, effect) => (effect.is(setBackend) ? effect.value : current), value),
  });

  const structureLint =
    dialect === 'jsonc'
      ? linter(
          json5ParseLinter((view, parsed) => {
            const syntax = jsoncDiagnostics(view.state);
            return syntax.length > 0 ? syntax : diagnosticsOf(view.state, view.state.field(field), parsed);
          }),
          { needsRefresh: refreshOnBackendChange },
        )
      : [
          jsonParseLinterExtension(),
          linter(
            (view) => {
              let parsed: unknown;
              try {
                parsed = JSON.parse(view.state.doc.toString());
              } catch {
                return [];
              }
              return diagnosticsOf(view.state, view.state.field(field), parsed);
            },
            { needsRefresh: refreshOnBackendChange },
          ),
        ];

  return [
    field,
    dialect === 'jsonc' ? json5() : json(),
    structureLint,
    (dialect === 'jsonc' ? json5Language : jsonLanguage).data.of({ autocomplete: completionSource(field) }),
    hoverSource(field),
  ];
}

/** Swaps the backend of an editor built with `createJsonAssistExtensions` and re-lints. */
export function updateJsonAssist(view: EditorView, backend: JsonAssistBackend): void {
  view.dispatch({ effects: setBackend.of(backend) });
}
