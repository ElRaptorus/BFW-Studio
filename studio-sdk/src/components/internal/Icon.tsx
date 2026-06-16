import React from 'react';

type IconProps = {
  id: string;
};

type IconAliasOrData = string | React.JSX.Element;

type IconMap = {
  [id: string]: IconAliasOrData;
};

const iconMap: IconMap = {};

/**
 * Renders a registered icon by its id.
 *
 * Icons are registered by modules via `studio.icons.registerIcons()`.
 * If the id matches a CSS class (e.g. Phosphor Icons), the icon is rendered as a `<span>` with that class.
 *
 * @example
 * ```tsx
 * import { Icon } from '@evil/bifrost_fw_sdk';
 *
 * function MyButton() {
 *   return <button><Icon id="my-plugin/star" /> Star</button>;
 * }
 * ```
 */
export function Icon(props: IconProps): React.JSX.Element {
  return getIcon(props.id);
}
Icon.registerIcon = function (id: string, icon: IconAliasOrData): void {
  iconMap[id] = icon;
};

/**
 * Internal: Returns a React component for the given `id`.
 */
function getIcon(id: string): React.JSX.Element {
  const result = iconMap[id];
  if (result == null) {
    // TODO: should we store the 'rendered' variant for Phosphor icons
    // instead of building them during lookup
    return buildFromClassName(id);
  }
  if (typeof result === 'string') {
    return getIcon(result);
  }
  return result;
}

function buildFromClassName(className: string): React.JSX.Element {
  return <span className={className} />;
}
