import React from 'react';

type SettingsSearchProps = {
  searchQuery: string;
  onChange: (query: string) => void;
};

export function SettingsSearch(props: SettingsSearchProps): React.JSX.Element {
  return (
    <div className="settings-gui__search">
      <input
        type="text"
        className="form-control"
        value={props.searchQuery}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder="Search settings..."
        autoFocus
      />
    </div>
  );
}
