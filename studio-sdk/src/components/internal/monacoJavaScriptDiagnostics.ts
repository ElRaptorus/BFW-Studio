import type * as monacoEditor from 'monaco-editor';

type MonacoTypescriptNamespace = typeof monacoEditor.typescript;

/**
 * Turns off JavaScript/TypeScript validation for the plain code editors, which host snippets and
 * expressions rather than complete programs.
 *
 * The `monacoInstance` parameter is intentionally untyped: `@monaco-editor/react` types its mount
 * argument as the editor API surface (`monaco-editor/esm/vs/editor/editor.api`), which does not
 * carry the language-feature namespaces even though the configured instance does.
 */
export function relaxJavaScriptDiagnostics(monacoInstance: unknown): void {
  const typescriptNamespace = resolveTypescriptNamespace(monacoInstance);

  if (typescriptNamespace == null) {
    console.warn('Monaco TypeScript language features are unavailable; JavaScript validation stays enabled.');
    return;
  }

  typescriptNamespace.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  typescriptNamespace.javascriptDefaults.setCompilerOptions({
    target: typescriptNamespace.ScriptTarget.ES5,
    allowNonTsExtensions: true,
    lib: ['es2019'],
  });
}

// monaco-editor moved the language-feature namespaces from `monaco.languages.<feature>` up to the
// module root in 0.53; the old properties are gone at runtime, not merely deprecated.
function resolveTypescriptNamespace(monacoInstance: unknown): MonacoTypescriptNamespace | null {
  const candidate = monacoInstance as
    | { typescript?: MonacoTypescriptNamespace; languages?: { typescript?: MonacoTypescriptNamespace } }
    | null
    | undefined;

  return candidate?.typescript ?? candidate?.languages?.typescript ?? null;
}
