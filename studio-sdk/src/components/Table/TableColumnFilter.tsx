import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DateRangeFilterValue, DurationRangeFilterValue, TableColumnMeta } from './types';

type TableColumnFilterProps = {
  columnId: string;
  columnMeta?: TableColumnMeta;
  value: unknown;
  onChange: (columnId: string, value: unknown) => void;
};

export function TableColumnFilter(props: TableColumnFilterProps): React.JSX.Element | null {
  const { columnId, columnMeta, value, onChange } = props;

  if (columnMeta?.filterVariant == null) {
    return null;
  }

  switch (columnMeta.filterVariant) {
    case 'text':
      return <DebouncedTextFilter columnId={columnId} value={value} onChange={onChange} />;

    case 'multi-select':
      return (
        <MultiSelectDropdown
          columnId={columnId}
          options={columnMeta.filterOptions ?? []}
          value={value}
          onChange={onChange}
        />
      );

    case 'boolean': {
      const currentValue = value as boolean | undefined;

      return (
        <select
          className="form-select form-select-sm studio-table__filter-select"
          value={currentValue == null ? '' : String(currentValue)}
          onChange={(event) => {
            const selectedValue = event.target.value;
            onChange(columnId, selectedValue === '' ? undefined : selectedValue === 'true');
          }}
          onClick={(event) => event.stopPropagation()}
          data-test--column-filter={columnId}
        >
          <option value="">All</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    case 'date-range':
      return (
        <DateRangeFilterPopover
          columnId={columnId}
          value={value as DateRangeFilterValue | undefined}
          onChange={onChange}
          labels={columnMeta.filterRangeLabels ?? { from: 'After', to: 'Before' }}
        />
      );

    case 'duration-range':
      return (
        <DurationRangeFilterPopover
          columnId={columnId}
          value={value as DurationRangeFilterValue | undefined}
          onChange={onChange}
          labels={columnMeta.filterRangeLabels ?? { from: 'Greater than or equal', to: 'Less than' }}
        />
      );
  }
}

// ─── Debounced text filter ────────────────────────────
const TEXT_FILTER_DEBOUNCE_MS = 350;

type DebouncedTextFilterProps = {
  columnId: string;
  value: unknown;
  onChange: (columnId: string, value: unknown) => void;
};

function DebouncedTextFilter({ columnId, value, onChange }: DebouncedTextFilterProps): React.JSX.Element {
  const externalValue = (value as string) ?? '';
  const [localValue, setLocalValue] = useState(externalValue);
  const [lastSyncedExternal, setLastSyncedExternal] = useState(externalValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (externalValue !== lastSyncedExternal) {
    setLastSyncedExternal(externalValue);
    setLocalValue(externalValue);
  }

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setLocalValue(next);

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(columnId, next || undefined);
      }, TEXT_FILTER_DEBOUNCE_MS);
    },
    [columnId, onChange],
  );

  return (
    <input
      className="form-control form-control-sm studio-table__filter-input"
      type="text"
      placeholder="Filter..."
      value={localValue}
      onChange={handleChange}
      onClick={(event) => event.stopPropagation()}
      data-test--column-filter={columnId}
    />
  );
}

// ─── Multi-select dropdown ────────────────────────────
type MultiSelectDropdownProps = {
  columnId: string;
  options: { value: string; label: string }[];
  value: unknown;
  onChange: (columnId: string, value: unknown) => void;
};

function MultiSelectDropdown({ columnId, options, value, onChange }: MultiSelectDropdownProps): React.JSX.Element {
  const selectedValues = useMemo(() => (value as string[] | undefined) ?? [], [value]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current != null && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const toggleOption = useCallback(
    (optionValue: string) => {
      const isSelected = selectedValues.includes(optionValue);
      const updated = isSelected
        ? selectedValues.filter((selected) => selected !== optionValue)
        : [...selectedValues, optionValue];
      onChange(columnId, updated.length > 0 ? updated : undefined);
    },
    [columnId, selectedValues, onChange],
  );

  const summary = getSummary(selectedValues, options);

  return (
    <div
      ref={containerRef}
      className="studio-table__filter-multiselect-dropdown"
      onClick={(event) => event.stopPropagation()}
      data-test--column-filter={columnId}
    >
      <button
        type="button"
        className="studio-table__filter-multiselect-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="studio-table__filter-multiselect-summary">{summary}</span>
        <i className={`ph ph-caret-${open ? 'up' : 'down'}`} />
      </button>
      {open && (
        <div className="studio-table__filter-multiselect-panel">
          {options.map((option) => {
            const isChecked = selectedValues.includes(option.value);
            return (
              <label key={option.value} className="studio-table__filter-multiselect-option">
                <input type="checkbox" checked={isChecked} onChange={() => toggleOption(option.value)} />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getSummary(selectedValues: string[], options: { value: string; label: string }[]): string {
  if (selectedValues.length === 0) {
    return 'All';
  }
  if (selectedValues.length <= 2) {
    return selectedValues.map((val) => options.find((opt) => opt.value === val)?.label ?? val).join(', ');
  }
  return `${selectedValues.length} selected`;
}

// ─── Date range filter popover ────────────────────────
type DateRangeFilterPopoverProps = {
  columnId: string;
  value: DateRangeFilterValue | undefined;
  onChange: (columnId: string, value: unknown) => void;
  labels: { from: string; to: string };
};

function toDatetimeLocalValue(value: string | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return value;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function formatDateRangeSummary(value: DateRangeFilterValue | undefined, labels: { from: string; to: string }): string {
  if (!value) {
    return '';
  }
  const parts: string[] = [];
  if (value.after) {
    parts.push(`${labels.from}: ${value.after}`);
  }
  if (value.before) {
    parts.push(`${labels.to}: ${value.before}`);
  }
  return parts.join(' · ');
}

function DateRangeFilterPopover({ columnId, value, onChange, labels }: DateRangeFilterPopoverProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [localAfter, setLocalAfter] = useState(() => toDatetimeLocalValue(value?.after));
  const [localBefore, setLocalBefore] = useState(() => toDatetimeLocalValue(value?.before));
  const containerRef = useRef<HTMLDivElement>(null);

  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setLocalAfter(toDatetimeLocalValue(value?.after));
    setLocalBefore(toDatetimeLocalValue(value?.before));
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current != null && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setLocalAfter(toDatetimeLocalValue(value?.after));
        setLocalBefore(toDatetimeLocalValue(value?.before));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, value]);

  const hasActiveFilter = value?.after != null || value?.before != null;

  const handleApply = (): void => {
    const next: DateRangeFilterValue = {};
    if (localAfter) {
      next.after = localAfter;
    }
    if (localBefore) {
      next.before = localBefore;
    }
    onChange(columnId, Object.keys(next).length > 0 ? next : undefined);
    setOpen(false);
  };

  const handleClear = (): void => {
    setLocalAfter('');
    setLocalBefore('');
    onChange(columnId, undefined);
    setOpen(false);
  };

  const handleCancel = (): void => {
    setLocalAfter(toDatetimeLocalValue(value?.after));
    setLocalBefore(toDatetimeLocalValue(value?.before));
    setOpen(false);
  };

  const summary = formatDateRangeSummary(value, labels);

  return (
    <div
      ref={containerRef}
      className="studio-table__filter-range-popover"
      onClick={(event) => event.stopPropagation()}
      data-test--column-filter={columnId}
    >
      <button
        type="button"
        className={`studio-table__filter-range-trigger ${hasActiveFilter ? 'studio-table__filter-range-trigger--active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        title={summary || undefined}
      >
        <i className="ph ph-funnel" />
        {hasActiveFilter && <span className="studio-table__filter-range-badge" />}
      </button>
      {open && (
        <div className="studio-table__filter-range-panel">
          <div className="studio-table__filter-range-field">
            <label className="studio-table__filter-range-label">{labels.from}</label>
            <input
              type="datetime-local"
              step="1"
              className="form-control form-control-sm studio-table__filter-input"
              value={localAfter}
              onChange={(event) => setLocalAfter(event.target.value)}
            />
          </div>
          <div className="studio-table__filter-range-field">
            <label className="studio-table__filter-range-label">{labels.to}</label>
            <input
              type="datetime-local"
              step="1"
              className="form-control form-control-sm studio-table__filter-input"
              value={localBefore}
              onChange={(event) => setLocalBefore(event.target.value)}
            />
          </div>
          <div className="studio-table__filter-range-actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            {hasActiveFilter && (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleClear}>
                Clear
              </button>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={handleApply}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Duration range filter popover ────────────────────
type DurationRangeFilterPopoverProps = {
  columnId: string;
  value: DurationRangeFilterValue | undefined;
  onChange: (columnId: string, value: unknown) => void;
  labels: { from: string; to: string };
};

function DurationRangeFilterPopover({
  columnId,
  value,
  onChange,
  labels,
}: DurationRangeFilterPopoverProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [localGreaterThanOrEqual, setLocalGreaterThanOrEqual] = useState(
    value?.greaterThanOrEqual != null ? String(value.greaterThanOrEqual) : '',
  );
  const [localLessThan, setLocalLessThan] = useState(value?.lessThan != null ? String(value.lessThan) : '');
  const containerRef = useRef<HTMLDivElement>(null);

  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setLocalGreaterThanOrEqual(value?.greaterThanOrEqual != null ? String(value.greaterThanOrEqual) : '');
    setLocalLessThan(value?.lessThan != null ? String(value.lessThan) : '');
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current != null && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setLocalGreaterThanOrEqual(value?.greaterThanOrEqual != null ? String(value.greaterThanOrEqual) : '');
        setLocalLessThan(value?.lessThan != null ? String(value.lessThan) : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, value]);

  const hasActiveFilter = value?.greaterThanOrEqual != null || value?.lessThan != null;

  const handleApply = (): void => {
    const next: DurationRangeFilterValue = {};
    const parsedGreaterThanOrEqual = parseInt(localGreaterThanOrEqual, 10);
    const parsedLessThan = parseInt(localLessThan, 10);
    if (!isNaN(parsedGreaterThanOrEqual) && parsedGreaterThanOrEqual > 0) {
      next.greaterThanOrEqual = parsedGreaterThanOrEqual;
    }
    if (!isNaN(parsedLessThan) && parsedLessThan > 0) {
      next.lessThan = parsedLessThan;
    }
    onChange(columnId, Object.keys(next).length > 0 ? next : undefined);
    setOpen(false);
  };

  const handleCancel = (): void => {
    setLocalGreaterThanOrEqual(value?.greaterThanOrEqual != null ? String(value.greaterThanOrEqual) : '');
    setLocalLessThan(value?.lessThan != null ? String(value.lessThan) : '');
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="studio-table__filter-range-popover"
      onClick={(event) => event.stopPropagation()}
      data-test--column-filter={columnId}
    >
      <button
        type="button"
        className={`studio-table__filter-range-trigger ${hasActiveFilter ? 'studio-table__filter-range-trigger--active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <i className="ph ph-funnel" />
        {hasActiveFilter && <span className="studio-table__filter-range-badge" />}
      </button>
      {open && (
        <div className="studio-table__filter-range-panel">
          <div className="studio-table__filter-range-field">
            <label className="studio-table__filter-range-label">{labels.from}</label>
            <input
              type="number"
              className="form-control form-control-sm studio-table__filter-input"
              placeholder="0"
              value={localGreaterThanOrEqual}
              onChange={(event) => setLocalGreaterThanOrEqual(event.target.value)}
            />
          </div>
          <div className="studio-table__filter-range-field">
            <label className="studio-table__filter-range-label">{labels.to}</label>
            <input
              type="number"
              className="form-control form-control-sm studio-table__filter-input"
              placeholder="0"
              value={localLessThan}
              onChange={(event) => setLocalLessThan(event.target.value)}
            />
          </div>
          <div className="studio-table__filter-range-actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleApply}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
