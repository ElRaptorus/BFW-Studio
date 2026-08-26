import type { Bifrost } from '#bifrost/Bifrost';
import { MultiLineCodeEditor } from '#components/MultiLineCodeEditor';

import React, { useCallback, useMemo, useState } from 'react';

import { KeyValueBuilder, entriesToJson, jsonToEntries } from './KeyValueBuilder';
import type { KeyValueEntry } from './KeyValueBuilder';
import './KeyValueBuilder.scss';

export type KeyValueJsonEditorProps = {
  readonly studio: Bifrost;
  readonly initialValue: string;
  readonly onChange: (jsonString: string) => void;
  readonly keyPlaceholder?: string;
  readonly valuePlaceholder?: string;
  readonly hint?: string;
  readonly emptyMessage?: string;
  readonly htmlId?: string;
  readonly htmlAttributes?: Record<string, unknown>;
};

/**
 * A dual-mode editor that shows a key-value builder for flat JSON objects and
 * falls back to a raw JSON editor for complex / nested data. The user can
 * toggle between modes at any time.
 *
 * When the stored value is a non-object (array, primitive) or contains nested
 * objects/arrays, the component starts in raw JSON mode automatically because
 * those structures cannot be represented as flat key-value pairs.
 */
export function KeyValueJsonEditor(props: KeyValueJsonEditorProps): React.JSX.Element {
  const { onChange } = props;
  const parsedEntries = useMemo(() => jsonToEntries(props.initialValue), [props.initialValue]);
  const canUseBuilder = useMemo(() => isBuilderCompatible(props.initialValue), [props.initialValue]);

  const [rawMode, setRawMode] = useState(!canUseBuilder);

  const handleBuilderChange = useCallback(
    (entries: readonly KeyValueEntry[]) => {
      onChange(entriesToJson(entries));
    },
    [onChange],
  );

  const handleRawChange = useCallback(
    (value: string) => {
      onChange(value);
    },
    [onChange],
  );

  const toggleMode = useCallback(() => {
    setRawMode((prev) => !prev);
  }, []);

  return (
    <div>
      <div className="kv-builder-wrapper__toggle">
        <button type="button" onClick={toggleMode}>
          {rawMode ? 'Switch to Builder' : 'Switch to JSON'}
        </button>
      </div>

      {rawMode ? (
        <MultiLineCodeEditor
          studio={props.studio}
          htmlId={props.htmlId ?? 'kv-json-editor'}
          initialValue={props.initialValue}
          size="tall"
          fontSize={12}
          language="json"
          onChange={handleRawChange}
          htmlAttributes={props.htmlAttributes}
        />
      ) : (
        <KeyValueBuilder
          initialEntries={parsedEntries}
          onChange={handleBuilderChange}
          keyPlaceholder={props.keyPlaceholder}
          valuePlaceholder={props.valuePlaceholder}
          hint={props.hint ?? 'Smart typing: true/false → boolean, numbers → number, null → null, rest → string'}
          emptyMessage={props.emptyMessage}
          htmlAttributes={props.htmlAttributes}
        />
      )}
    </div>
  );
}

function isBuilderCompatible(jsonString: string): boolean {
  if (!jsonString.trim()) {
    return true;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return false;
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false;
  }

  const record = parsed as Record<string, unknown>;
  return Object.values(record).every(
    (value) => value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
  );
}
