export type QuickJumpOptions = {
  readonly entries: QuickJumpItem[];
  readonly prompt?: string;
};

export type QuickJumpOpenEntryFn = (item: QuickJumpItem, query: string, event?: any) => void;

export type QuickJumpItem = QuickJumpItem_Callback | QuickJumpItem_Command | QuickJumpItem_Text;

/**
 * A QuickJumpItem that executes a command
 */
export type QuickJumpItem_Command = {
  type: 'command';

  /**
   * Text to be displayed
   */
  readonly label: string;

  /**
   * Text to be highlighted
   */
  readonly labelHighlight?: string[];

  /**
   * Optional: Subtext to be displayed
   */
  readonly sublabel?: string;

  /**
   * Optional: Subtext to be highlighted
   */
  readonly sublabelHighlight?: string[];

  /**
   * The icon id for the icon to be displayed
   */
  readonly icon?: string;

  /**
   * Name of the command to execute on click
   */
  readonly command: string;

  /**
   * Optional: Arguments for the command
   */
  readonly commandArgs?: any[];

  /**
   * If set to `true`, will add the executed command to the list of recently executed commands
   */
  readonly addToRecentlyOpened?: boolean;

  /**
   * Set to a formatted, human-readable version of the keystroke activating the `command`
   */
  formattedKeystroke?: string;

  readonly badges?: QuickJumpItemBadge[];

  readonly sticky?: boolean;
};

/**
 * A QuickJumpItem that executes a callback function
 */
export type QuickJumpItem_Callback = {
  type: 'callback';

  /**
   * Text to be displayed
   */
  readonly label: string;

  /**
   * Text to be highlighted
   */
  readonly labelHighlight?: string[];

  /**
   * Optional: Subtext to be displayed
   */
  readonly sublabel?: string;

  /**
   * Optional: Subtext to be highlighted
   */
  readonly sublabelHighlight?: string[];

  /**
   * The icon id for the icon to be displayed
   */
  readonly icon?: string;

  /**
   * Callback to execute on click
   */
  readonly callbackFn: () => void;

  readonly badges?: QuickJumpItemBadge[];

  readonly sticky?: boolean;
};

/**
 * A QuickJumpItem that displays a text
 */
export type QuickJumpItem_Text = {
  type: 'text';

  /**
   * Text to be displayed
   */
  readonly label: string;

  /**
   * Text to be highlighted
   */
  readonly labelHighlight?: string[];

  /**
   * Optional: Subtext to be displayed
   */
  readonly sublabel?: string;

  /**
   * Optional: Subtext to be highlighted
   */
  readonly sublabelHighlight?: string[];

  /**
   * The icon id for the icon to be displayed
   */
  readonly icon?: string;

  readonly badges?: QuickJumpItemBadge[];

  readonly sticky?: boolean;
};

export type QuickJumpItemBadge = QuickJumpItemBadge_Text | QuickJumpItemBadge_Icon;

type QuickJumpItemBadge_Text = {
  type: 'text';
  readonly text: string;
};

type QuickJumpItemBadge_Icon = {
  type: 'icon';
  readonly icon: string;
};

export type QuickJumpViewData = {
  readonly visible: boolean;
  readonly prompt: string;
  readonly initialInputValue: string;
  readonly allEntries: QuickJumpItem[];
  readonly filteredEntries: QuickJumpItem[];
  readonly selectedIndex: number;
};
