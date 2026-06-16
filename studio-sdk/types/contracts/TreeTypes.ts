export declare type TreeItemClickCallbackFn = (itemMetadata: any) => void;
export declare type TreeItemDropCallbackFn = (draggedItem: TreeItem, dropTarget: TreeItem) => void | Promise<void>;

export declare type TreeItemDecoration = {
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

export declare type TreeItemTransformer = {
  pathIdTransform?: (...args: any[]) => any;
  entryTransform?: (...args: any[]) => any;
};
export declare type TreeItem =
  | TreeItem_Directory
  | TreeItem_Section
  | TreeItem_File
  | TreeItem_SearchResult
  | TreeItem_PropertyString;
declare type TreeItemBase = {
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
export declare type TreeItemStyles = {
  readonly labelColor?: TreeItemColor;
  readonly subLabelColor?: TreeItemColor;
  readonly badgeColor?: TreeItemColor;
  readonly shrinking?: boolean;
};
export declare type TreeItemColor =
  | 'black'
  | 'gray'
  | 'white'
  | 'blue'
  | 'yellow'
  | 'gold'
  | 'red'
  | 'purple'
  | 'orange'
  | 'green'
  | string;
declare type TreeItem_Directory = TreeItemBase & {
  type: 'directory';
};
declare type TreeItem_Section = TreeItemBase & {
  type: 'section';
};
declare type TreeItem_File = TreeItemBase & {
  type: 'file';
};
declare type TreeItem_SearchResult = TreeItemBase & {
  type: 'search_result';
};
declare type TreeItem_PropertyString = TreeItemBase & {
  type: 'property';
  subtype: 'string';
  readonly value: string;
  readonly readonly?: boolean;
};
export declare type TreeBadge = TreeBadge_Character | TreeBadge_Icon | TreeBadge_Number;
declare type TreeBadge_Character = {
  type: 'character';
  readonly character: string;
};
declare type TreeBadge_Icon = {
  type: 'icon';
  readonly icon: string;
};
declare type TreeBadge_Number = {
  type: 'number';
  readonly number: number;
};
export {};
