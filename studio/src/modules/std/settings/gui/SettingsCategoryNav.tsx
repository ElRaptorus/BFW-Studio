import React from 'react';

type SettingsCategoryNavProps = {
  categories: string[];
  activeCategory: string | null;
  onCategoryClick: (category: string) => void;
};

export function SettingsCategoryNav(props: SettingsCategoryNavProps): React.JSX.Element {
  return (
    <nav className="settings-gui__nav">
      {props.categories.map((category) => {
        const isActive = category === props.activeCategory;
        const className = `settings-gui__nav-item ${isActive ? 'settings-gui__nav-item--active' : ''}`;

        return (
          <button key={category} className={className} onClick={() => props.onCategoryClick(category)} title={category}>
            {category}
          </button>
        );
      })}
    </nav>
  );
}
