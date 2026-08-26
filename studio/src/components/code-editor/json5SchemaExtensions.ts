import { linter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import { hoverTooltip } from '@codemirror/view';
import { json5, json5Language, json5ParseLinter } from 'codemirror-json5';
import { handleRefresh, stateExtensions } from 'codemirror-json-schema';
import { json5Completion, json5SchemaHover, json5SchemaLinter } from 'codemirror-json-schema/json5';
import type { JSONSchema7 } from 'json-schema';

import { rewriteUnknownSettingDiagnostics } from './unknownSettingDiagnostics';

/**
 * Same surface as `json5Schema()` from `codemirror-json-schema/json5`, with
 * unknown-key diagnostics rewritten to a Settings warning.
 */
export function createJson5SchemaExtensions(schema: JSONSchema7): Extension {
  const parseLinter = json5ParseLinter();
  const schemaLinter = json5SchemaLinter();

  return [
    json5(),
    linter(parseLinter),
    linter((view) => rewriteUnknownSettingDiagnostics(schemaLinter(view)), {
      needsRefresh: handleRefresh,
    }),
    json5Language.data.of({
      autocomplete: json5Completion(),
    }),
    hoverTooltip(json5SchemaHover()),
    stateExtensions(schema),
  ];
}
