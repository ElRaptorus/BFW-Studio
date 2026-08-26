import { Bifrost } from '#bifrost/Bifrost';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import type { PluginInfo } from '#bifrost/contracts/PluginHostTypes';
import { Pane } from '#components/panes/Pane';
import Select from 'react-select';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STDERR_MARKER = '[stderr]';

function isStderrLine(line: string): boolean {
  return line.includes(STDERR_MARKER);
}

interface PluginOption {
  label: string;
  value: string;
}

export const paneProvider: PaneProvider = {
  getPaneTitle: () => 'Plugin Host',
  Pane: ConsolePaneFull,
  PaneTabOptions: ConsolePaneTabOptions,
  PaneContent: ConsolePaneContent,
};

function ConsolePaneFull(props: PaneComponentProps): React.JSX.Element {
  return <Pane>{props.collapsed !== true && <ConsolePaneContent {...props} />}</Pane>;
}

function getPortalTarget(): HTMLElement {
  return (document.querySelector('.bifrost') as HTMLElement) ?? document.body;
}

function ConsolePaneTabOptions(props: PaneComponentProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);

  const pluginOptions = useMemo<PluginOption[]>(() => {
    const pluginList: PluginInfo[] = bifrost.plugins.getPluginList();
    return pluginList.map((plugin) => ({
      label: plugin.displayName || plugin.name,
      value: plugin.name,
    }));
  }, [bifrost]);

  const onClear = useCallback(() => {
    bifrost.plugins.clearPluginHostLog();
  }, [bifrost]);

  const onFilterChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      (props as any).onChangeDataFromPaneTabOptions({
        ...props.dataFromPaneTabOptions,
        filterText: event.target.value,
      });
    },
    [props],
  );

  const onPluginFilterChange = useCallback(
    (selected: readonly PluginOption[]) => {
      (props as any).onChangeDataFromPaneTabOptions({
        ...props.dataFromPaneTabOptions,
        selectedPlugins: selected.map((option) => option.value),
      });
    },
    [props],
  );

  const selectedPluginValues: string[] = props.dataFromPaneTabOptions?.selectedPlugins ?? [];
  const selectedOptions = pluginOptions.filter((option) => selectedPluginValues.includes(option.value));

  return (
    <div className="pane-tab-input__outer" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ minWidth: 260 }} data-test--console-plugin-filter="">
        <Select<PluginOption, true>
          options={pluginOptions}
          value={selectedOptions}
          onChange={onPluginFilterChange}
          isMulti={true}
          isClearable={true}
          isSearchable={true}
          placeholder="All plugins"
          className="react-select"
          classNamePrefix="react-select"
          menuPortalTarget={getPortalTarget()}
          styles={{
            control: (base) => ({ ...base, minHeight: 24, fontSize: 12 }),
            valueContainer: (base) => ({ ...base, padding: '0 4px' }),
            multiValue: (base) => ({ ...base, fontSize: 11 }),
            indicatorsContainer: (base) => ({ ...base, height: 24 }),
            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
          }}
        />
      </div>
      <div style={{ flex: 1 }} />
      <input
        type="text"
        className="pane-tab-input"
        placeholder="Filter..."
        style={{ width: 420 }}
        onChange={onFilterChange}
        data-test--console-filter=""
      />
      <button
        className="pane-action-button"
        title="Clear console"
        onClick={onClear}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
        data-test--console-clear=""
      >
        <i className="ph ph-trash" />
      </button>
    </div>
  );
}

type PluginHostLogLine = {
  id: string;
  text: string;
};

function ConsolePaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);
  const [lines, setLines] = useState<PluginHostLogLine[]>(() =>
    bifrost.plugins.getPluginHostLog().map((text) => ({ id: crypto.randomUUID(), text })),
  );
  const [pinToBottom, setPinToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const subscription = bifrost.plugins.onPluginHostLog((line: string) => {
      setLines((prev) => [...prev, { id: crypto.randomUUID(), text: line }]);
    });
    return () => subscription.dispose();
  }, [bifrost]);

  useEffect(() => {
    if (pinToBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, pinToBottom]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
      setPinToBottom(isAtBottom);
    }
  }, []);

  const filterText: string = props.dataFromPaneTabOptions?.filterText ?? '';
  const lowercaseFilter = filterText.toLowerCase();
  const lowercasePluginNames = useMemo(() => {
    const selectedPlugins: string[] = props.dataFromPaneTabOptions?.selectedPlugins ?? [];
    return selectedPlugins.map((name) => name.toLowerCase());
  }, [props.dataFromPaneTabOptions?.selectedPlugins]);

  const filteredLines = useMemo(() => {
    let result = lines;
    if (lowercasePluginNames.length > 0) {
      result = result.filter((line) => {
        const lower = line.text.toLowerCase();
        return lowercasePluginNames.some((pluginName) => lower.includes(pluginName));
      });
    }
    if (lowercaseFilter) {
      result = result.filter((line) => line.text.toLowerCase().includes(lowercaseFilter));
    }
    return result;
  }, [lines, lowercasePluginNames, lowercaseFilter]);

  return (
    <div className="pane__content plugin-host-console" style={{ minHeight: '60px' }}>
      <div
        ref={scrollRef}
        className="plugin-host-console__scroll"
        onScroll={handleScroll}
        style={{
          overflow: 'auto',
          height: '100%',
          fontFamily: 'var(--studio-font-family-mono, monospace)',
          fontSize: 'var(--studio-font-size-small, 12px)',
          lineHeight: '1.4',
          padding: '4px 8px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {filteredLines.length === 0 && (
          <div style={{ color: 'var(--studio-color-text-muted, #888)', fontStyle: 'italic', padding: '8px 0' }}>
            {lines.length === 0 ? 'No plugin host output yet.' : 'No matching lines.'}
          </div>
        )}
        {filteredLines.map((line) => (
          <div
            key={line.id}
            className={`plugin-host-console__line ${isStderrLine(line.text) ? 'plugin-host-console__line--error' : ''}`}
            style={{
              color: isStderrLine(line.text) ? 'var(--studio-color-error, #e06c75)' : undefined,
            }}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
