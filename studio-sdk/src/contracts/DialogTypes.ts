export type Dialog = {
  id: string;
  options: DialogOptionsStrict;
  responseCallbackFn: DialogResponseCallbackFn;
  validationResult?: DialogValidationResult;
};

export type DialogOptions =
  | DialogOptions_Custom
  | DialogOptions_MessageBox
  | DialogOptionsStrict_OpenFile
  | DialogOptionsStrict_OpenDirectory
  | DialogOptionsStrict_SaveFile;

export type DialogOptions_Custom = {
  /**
   * Type of the dialog
   */
  readonly type?: 'custom';

  /**
   * Allows for additional CSS Customization.
   */
  readonly className?: string;

  /**
   * If true, the "X" in the top right corner will be hidden.
   */
  readonly hideCloseButton?: boolean;

  /**
   * Title of the dialog
   */
  readonly title: string;

  /**
   * Content of the dialog, can be a `string` or an array of `DialogContentObject`s, which can contain form elements
   */
  readonly content: DialogContent;

  /**
   * Actions which the user can take
   */
  readonly actions: DialogAction[];
};

export type DialogOptions_MessageBox = {
  readonly type: 'message-box';

  readonly content: DialogContent;

  readonly actions: DialogActionStrict[];
};

export type DialogOptionsStrict =
  | DialogOptionsStrict_Custom
  | DialogOptionsStrict_MessageBox
  | DialogOptionsStrict_OpenDirectory
  | DialogOptionsStrict_OpenFile
  | DialogOptionsStrict_SaveFile;

export type DialogOptionsStrict_Custom = {
  readonly type: 'custom';

  readonly title: string;

  readonly className?: string;

  readonly hideCloseButton?: boolean;

  readonly content: DialogContentStrict;

  readonly actions: DialogActionStrict[];
};

export type DialogOptionsStrict_MessageBox = {
  readonly type: 'message-box';

  readonly content: DialogContentStrict;

  readonly actions: DialogActionStrict[];
};

export type DialogOptionsStrict_OpenFile = {
  readonly type: 'open-file';

  title?: string;

  defaultPath?: string;

  message?: string;

  filters?: {
    name: string;
    extensions: string[];
  }[];

  properties?: (
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
    | 'treatPackageAsDirectory'
    | 'dontAddToRecent'
  )[];
};

export type DialogOptionsStrict_OpenDirectory = {
  readonly type: 'open-directory';
};

export type DialogOptionsStrict_SaveFile = {
  readonly type: 'save-file';

  title?: string;

  defaultPath?: string;

  buttonLabel?: string;

  filters?: {
    name: string;
    extensions: string[];
  }[];
};

export type DialogContent = string | DialogContentObject[];

export type DialogContentStrict = DialogContentObject[];

export type DialogContentObject =
  | DialogContentObject_Checkbox
  | DialogContentObject_ResponseLink
  | DialogContentObject_Divider
  | DialogContentObject_Diff
  | DialogContentObject_Json
  | DialogContentObject_Section
  | DialogContentObject_MarkdownEditor
  | DialogContentObject_Markdown
  | DialogContentObject_Text
  | DialogContentObject_TextInput
  | DialogContentObject_Select
  | DialogContentObject_PathList
  | DialogContentObject_PathPicker
  | DialogContentObject_KeyValueBuilder;

export type DialogContentObject_ResponseLink = {
  readonly type: 'response_link';
  readonly label: string;
  readonly sublabel?: string;
  readonly icon?: string;
  readonly response: string;
};

export type DialogContentObject_Divider = {
  type: 'divider';
};

export type DialogContentObject_Checkbox = {
  type: 'checkbox';
  readonly label?: string;
  readonly id: string;
  readonly checked?: boolean;
};

export type DialogContentObject_Json = {
  type: 'json';
  readonly label?: string;
  readonly id: string;
  readonly language?: string;
  readonly value?: ((dialogContent: DialogContentStrict, currentValue?: string) => string | undefined) | string;
  readonly focus?: boolean;
  readonly optional?: boolean;
  readonly readOnly?: boolean;
  readonly hint?: string;
  readonly size?: 'small' | 'medium' | 'tall';
  readonly validationErrors?: DialogValidationError[];
};

export type DialogContentObject_Diff = {
  type: 'diff';
  readonly label?: string;
  readonly id: string;
  readonly language?: string;
  readonly beforeValue?: ((dialogContent: DialogContentStrict, currentValue?: string) => string | undefined) | string;
  readonly afterValue?: ((dialogContent: DialogContentStrict, currentValue?: string) => string | undefined) | string;
  readonly focus?: boolean;
  readonly optional?: boolean;
  readonly readOnly?: boolean;
  readonly hint?: string;
  readonly size?: 'small' | 'medium' | 'tall';
  readonly validationErrors?: DialogValidationError[];
};

export type DialogContentObject_TextInput = {
  type: 'text_input';
  readonly label?: string;
  readonly id: string;
  readonly value?: ((dialogContent: DialogContentStrict, currentValue?: string) => string | undefined) | string;
  readonly defaultSelection?: {
    startIndex: number;
    endIndex: number;
  };
  readonly placeholder?: string;
  readonly readonly?: boolean;
  readonly focus?: boolean;
  readonly multiline?: boolean;
  readonly masked?: boolean;
  readonly optional?: boolean;
  readonly hint?: string;
  readonly validationErrors?: DialogValidationError[];
};

export type DialogContentObject_Select = {
  type: 'select';
  readonly label?: string;
  readonly id: string;
  readonly value?: string;
  readonly entries: { label: string; value: any }[];
  readonly hint?: string;
  readonly validationErrors?: DialogValidationError[];
};

export type DialogContentObject_PathList = {
  type: 'path_list';
  readonly label?: string;
  readonly id: string;
  readonly mode: 'file' | 'directory';
  readonly initialValue?: string[];
  readonly hint?: string;
  readonly validationErrors?: DialogValidationError[];
};

export type DialogContentObject_PathPicker = {
  type: 'path_picker';
  readonly label?: string;
  readonly id: string;
  readonly mode: 'file' | 'directory';
  readonly placeholder?: string;
  readonly initialValue?: string;
  readonly hint?: string;
  readonly validationErrors?: DialogValidationError[];
};

export type DialogContentObject_Section = {
  type: 'section';
  readonly text: string;
};

export type DialogContentObject_Text = {
  type: 'text';
  readonly text: string;
};

export declare type DialogContentObject_MarkdownEditor = {
  type: 'markdown_container';
  readonly id: string;
  readonly text?: string;
  readonly size?: 'small' | 'medium' | 'tall' | 'huge';
};

export declare type DialogContentObject_Markdown = {
  type: 'markdown';
  readonly text: string;
};

export type DialogContentObject_KeyValueBuilder = {
  type: 'key_value_builder';
  readonly id: string;
  readonly label?: string;
  readonly keyLabel?: string;
  readonly valueLabel?: string;
  readonly keyPlaceholder?: string;
  readonly valuePlaceholder?: string;
  readonly initialEntries?: readonly { key: string; value: string }[];
  readonly hint?: string;
  readonly optional?: boolean;
  readonly validationErrors?: DialogValidationError[];
};

/**
 * A callback triggered when the user choses an action.
 */
export type DialogResponseCallbackFn = (dialogResult: DialogResult) => Promise<void | DialogValidationResult>;

export type DialogValidationCallbackFn = (dialogResultToValidate: DialogResult) => Promise<DialogValidationResult>;

export type DialogValidationResult = DialogValidationResult_CloseDialog | DialogValidationResult_KeepDialogOpen;

type DialogValidationResult_CloseDialog = {
  readonly closeDialog: true;
};

type DialogValidationResult_KeepDialogOpen = {
  readonly closeDialog: false;
  readonly validationErrors: DialogValidationError[];
};

export type DialogValidationError = {
  readonly contentId: string;
  readonly errorLabel: string;
};

export type DialogAction = string | DialogActionObject;

export type DialogActionStrict = DialogActionObject;

export type DialogActionObject = {
  /**
   * A string representing the reponse by the user. When an action is triggered by the user,
   * this string is given to the response handler of the dialog.
   */
  readonly response: StandardDialogResponse | string;

  /**
   * Label of the button representing the action
   */
  readonly label: string;

  /**
   * Optional: If `true`, enables the action as the default choice (triggered by e.g. pressing RETURN in an input field)
   */
  readonly default?: boolean;

  /**
   * Optional: If `true`, emphazises that the action has potentially irrevocable consequnces.
   */
  readonly dangerous?: boolean;

  /**
   * Optional: If `true`, the dialog will be aborted and marked with "wasCancelled".
   */
  readonly cancel?: boolean;
};

export enum StandardDialogResponse {
  Submit = 'submit',
  Cancel = 'cancel',
}

export type DialogResult = {
  readonly wasCancelled: boolean;
  readonly response?: StandardDialogResponse | string;
  readonly formData?: DialogFormData;
};

export type DialogFormData = { [contentId: string]: any };
