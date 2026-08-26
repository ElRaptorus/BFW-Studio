export type TreeItemClickCallbackFn = (itemMetadata: any, event?: MouseEvent) => void;

export type TreeItemDropCallbackFn = (draggedItem: TreeItem, dropTarget: TreeItem) => void | Promise<void>;

export type TreeItemDecoration = {
  styles?: Partial<TreeItemStyles>;
  badges?: TreeBadge[];
};

export interface TreeDecorationProvider {
  provideDecoration(uri: string): TreeItemDecoration | null;
  onDidChange(listener: (uris: string[]) => void): { dispose(): void };
}

export interface TreeDecorationSource {
  getDecoration(uri: string): TreeItemDecoration | null;
  subscribe(listener: (changedUris: Set<string>) => void): { dispose(): void };
}

export type TreeItemTransformer = {
  pathIdTransform?: (...args: any[]) => any;
  entryTransform?: (...args: any[]) => any;
};

export type TreeItem =
  TreeItem_Directory | TreeItem_Section | TreeItem_File | TreeItem_SearchResult | TreeItem_PropertyString;

type TreeItemBase = {
  readonly subtype?: string;

  pathId?: string;

  readonly actionIcon?: string;
  readonly actionIconOnHover?: string;
  readonly actionIconsOnHover?: readonly { icon: string; tooltip?: string; id: string }[];
  readonly actionInput?: string;
  readonly actionTooltip?: string;

  readonly label: string;
  readonly labelHighlight?: string;
  readonly labelIcon?: string;
  readonly labelTooltip?: string;

  readonly sublabel?: string;
  readonly sublabelHighlight?: string;

  readonly selected?: boolean;
  readonly expanded?: boolean;
  readonly entries?: TreeItem[];

  readonly metadata?: any;
  readonly styles?: TreeItemStyles;
  readonly badges?: TreeBadge[];

  readonly menuId?: string;

  onActionIconClick?: (...args: any[]) => any;
};

export type TreeItemStyles = {
  readonly labelColor?: TreeItemColor;
  readonly subLabelColor?: TreeItemColor;
  readonly badgeColor?: TreeItemColor;
  readonly shrinking?: boolean;
};

export type TreeItemColor =
  'black' | 'gray' | 'white' | 'blue' | 'yellow' | 'gold' | 'red' | 'purple' | 'orange' | 'green' | string;

type TreeItem_Directory = TreeItemBase & {
  type: 'directory';
};

type TreeItem_Section = TreeItemBase & {
  type: 'section';
};

type TreeItem_File = TreeItemBase & {
  type: 'file';
};

type TreeItem_SearchResult = TreeItemBase & {
  type: 'search_result';
};

type TreeItem_PropertyString = TreeItemBase & {
  type: 'property';
  subtype: 'string';

  readonly value: string;
  readonly readonly?: boolean;
};

export type TreeBadge = TreeBadge_Character | TreeBadge_Icon | TreeBadge_Number;

type TreeBadge_Character = {
  type: 'character';

  readonly character: string;
};

type TreeBadge_Icon = {
  type: 'icon';

  readonly icon: string;
};

type TreeBadge_Number = {
  type: 'number';

  readonly number: number;
};
