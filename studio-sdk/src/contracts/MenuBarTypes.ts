/**
 * `header` is the end of the workbench header's top row, `pageBarCenter` the centered section of the page bar and
 * `pageBarEnd` its right-pinned section.
 */
export type MenuBarItemArea = 'header' | 'pageBarCenter' | 'pageBarEnd';

export type MenuBarItem =
  | MenuBarItem_Button
  | MenuBarItem_Divider
  | MenuBarItem_Icon
  | MenuBarItem_Menu
  | MenuBarItem_Select
  | MenuBarItem_Text;

export type MenuBarItem_Button = {
  type: 'button';
  readonly id?: string;
  readonly visible?: boolean;
  readonly icon: string;
  readonly command: string;
  readonly commandArgs?: any[];
  readonly tooltip: string;
};

export type MenuBarItem_Divider = {
  type: 'divider';
  readonly id?: string;
  readonly visible?: boolean;
};

export type MenuBarItem_Icon = {
  type: 'icon';
  readonly id?: string;
  readonly visible?: boolean;
  readonly tooltip: string;
  readonly icon: string;
};

export type MenuBarItem_Menu = {
  type: 'menu';
  readonly id?: string;
  readonly visible?: boolean;
  readonly icon: string;
  readonly menu: string;
  readonly tooltip?: string;
};

export type MenuBarItem_Select = {
  type: 'select';
  readonly id?: string;
  readonly visible?: boolean;
  readonly value?: any;
  readonly entries: MenuBarItem_SelectEntry[];
  readonly command: string;
  readonly commandArgs?: any[];
  readonly tooltip?: string;
};

export type MenuBarItem_Text = {
  type: 'text';
  readonly id?: string;
  readonly visible?: boolean;
  readonly tooltip?: string;
  readonly label: string;
};

export type MenuBarItem_SelectEntry = {
  readonly value: any;
  readonly label: string;
};
