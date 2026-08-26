import type { JSX } from 'react';

/**
 * Host icon registry instance set on `IconMediator`. Matches the SDK `Icon`
 * function: a callable React component plus `registerIcon`.
 */
export type IconAliasOrData = string | JSX.Element;

export type IconComponent = {
  (props: { id: string }): JSX.Element;
  registerIcon(id: string, icon: IconAliasOrData): void;
};
