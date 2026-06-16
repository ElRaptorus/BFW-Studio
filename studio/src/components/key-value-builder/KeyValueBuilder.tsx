import React, { useCallback, useState } from 'react';

import { Icon } from '@evil/bifrost_fw_sdk';

import './KeyValueBuilder.scss';

export type KeyValueEntry = {
  key: string;
  value: string;
};

export type KeyValueBuilderProps = {
  readonly initialEntries: readonly KeyValueEntry[];
  readonly onChange: (entries: readonly KeyValueEntry[]) => void;
  readonly keyPlaceholder?: string;
  readonly valuePlaceholder?: string;
  readonly keyLabel?: string;
  readonly valueLabel?: string;
  readonly hint?: string;
  readonly emptyMessage?: string;
  readonly htmlAttributes?: Record<string, unknown>;
};

export function KeyValueBuilder(props: KeyValueBuilderProps): React.JSX.Element {
  const { onChange } = props;
  const [entries, setEntries] = useState<KeyValueEntry[]>(() => [...props.initialEntries]);

  const commit = useCallback(
    (next: KeyValueEntry[]) => {
      setEntries(next);
      onChange(next);
    },
    [onChange],
  );

  const addEntry = useCallback(() => {
    commit([...entries, { key: '', value: '' }]);
  }, [entries, commit]);

  const removeEntry = useCallback(
    (index: number) => {
      commit(entries.filter((_, entryIndex) => entryIndex !== index));
    },
    [entries, commit],
  );

  const updateEntry = useCallback(
    (index: number, field: 'key' | 'value', newValue: string) => {
      commit(entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [field]: newValue } : entry)));
    },
    [entries, commit],
  );

  return (
    <div className="kv-builder" {...(props.htmlAttributes ?? {})}>
      {entries.length > 0 && (
        <div className="kv-builder__header">
          <span className="kv-builder__col-key">{props.keyLabel ?? 'Key'}</span>
          <span className="kv-builder__col-sep" />
          <span className="kv-builder__col-value">{props.valueLabel ?? 'Value'}</span>
          <span className="kv-builder__col-action" />
        </div>
      )}

      {entries.map((entry, index) => (
        <div key={index} className="kv-builder__row">
          <input
            type="text"
            className="form-control kv-builder__input kv-builder__col-key"
            placeholder={props.keyPlaceholder ?? 'Key'}
            value={entry.key}
            onChange={(event) => updateEntry(index, 'key', event.target.value)}
          />
          <span className="kv-builder__separator">:</span>
          <input
            type="text"
            className="form-control kv-builder__input kv-builder__col-value"
            placeholder={props.valuePlaceholder ?? 'Value'}
            value={entry.value}
            onChange={(event) => updateEntry(index, 'value', event.target.value)}
          />
          <span className="kv-builder__remove" onClick={() => removeEntry(index)}>
            <Icon id="ph-duotone ph-trash" />
          </span>
        </div>
      ))}

      {entries.length === 0 && props.emptyMessage && <div className="kv-builder__empty">{props.emptyMessage}</div>}

      <button type="button" className="kv-builder__add-button" onClick={addEntry}>
        + Add entry
      </button>

      {props.hint && <div className="kv-builder__hint">{props.hint}</div>}
    </div>
  );
}

/**
 * Parses a raw string value into a typed JS value.
 * `"true"` / `"false"` → boolean, `"null"` → null, numeric strings → number,
 * everything else stays a string.
 */
export function smartParseValue(raw: string): unknown {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  if (raw === 'null') {
    return null;
  }
  if (raw !== '' && !isNaN(Number(raw)) && isFinite(Number(raw))) {
    return Number(raw);
  }
  return raw;
}

/**
 * Converts a JSON object string (e.g. `'{"a":1,"b":"hello"}'`) into an array
 * of `{ key, value }` string pairs suitable for the `KeyValueBuilder`.
 * Returns an empty array for invalid JSON, non-objects, or empty strings.
 */
export function jsonToEntries(jsonString: string): KeyValueEntry[] {
  if (!jsonString.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return [];
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [];
  }

  return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

/**
 * Converts an array of `{ key, value }` string pairs back into a JSON object
 * string. Empty rows are filtered out. Values are smart-parsed into their
 * natural JS types.
 * Returns an empty string when no non-empty entries remain.
 */
export function entriesToJson(entries: readonly KeyValueEntry[]): string {
  const nonEmpty = entries.filter((entry) => entry.key.trim() !== '' || entry.value.trim() !== '');
  if (nonEmpty.length === 0) {
    return '';
  }

  const result: Record<string, unknown> = {};
  for (const entry of nonEmpty) {
    result[entry.key.trim()] = smartParseValue(entry.value);
  }
  return JSON.stringify(result, null, 2);
}
