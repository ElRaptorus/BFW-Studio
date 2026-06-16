export type StatusBarItemArea = 'left' | 'center' | 'right';

export type StatusBarItem = StatusBarItem_Button | StatusBarItem_Divider | StatusBarItem_Menu;

export type StatusBarContent = StatusBarContentObject | StatusBarContentObject[];

type StatusBarContentObject = StatusBarContent_Text | StatusBarContent_Icon;

type StatusBarContent_Icon = {
  type: 'icon';
  readonly icon: string;
};

type StatusBarContent_Text = {
  type: 'text';
  readonly label: string;
};

export type StatusBarItem_Button = {
  type: 'button';
  readonly id: string;
  readonly visible?: boolean;
  readonly tooltip?: string;
  readonly content: StatusBarContent;
  readonly command: string;
  readonly commandArgs?: any[];
  readonly contextMenuId?: string;
  readonly contextMenuArgs?: any[];
  readonly active?: boolean;
};

export type StatusBarItem_Divider = {
  type: 'divider';
  readonly id: string;
  readonly visible?: boolean;
};

export type StatusBarItem_Menu = {
  type: 'menu';
  readonly id: string;
  readonly visible?: boolean;
  readonly tooltip?: string;
  readonly content: StatusBarContent;
  readonly menu: string;
  readonly active?: boolean;
};
