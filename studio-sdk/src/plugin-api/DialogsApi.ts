import type {
  PluginDialogOpenOptions,
  PluginDialogResult,
  PluginFileDialogOpenOptions,
  PluginFileDialogSaveOptions,
} from './types';

/**
 * Dialog API for showing modal dialogs and native file pickers.
 *
 * Mirrors the internal `DialogManager` with serializable constraints.
 * Validation callbacks are not supported in v1 — validate on the
 * returned `formData` after the dialog closes.
 */
export interface DialogsApi {
  /**
   * Show a custom modal dialog with form content and action buttons.
   *
   * @param options - Dialog configuration.
   * @returns The dialog result containing the user's response and form data.
   */
  open(options: PluginDialogOpenOptions): Promise<PluginDialogResult>;

  /**
   * Show a simple text prompt dialog.
   *
   * @param title - Dialog title.
   * @param placeholder - Optional input placeholder text.
   * @returns The entered text, or `null` if the user cancelled.
   */
  prompt(title: string, placeholder?: string): Promise<string | null>;

  /**
   * Show a native file open dialog (Electron-only).
   *
   * @param options - Optional file picker options.
   * @returns An array of selected file paths, or `null` if cancelled.
   */
  showOpenFile(options?: PluginFileDialogOpenOptions): Promise<string[] | null>;

  /**
   * Show a native directory picker dialog (Electron-only).
   *
   * @returns An array of selected directory paths, or `null` if cancelled.
   */
  showOpenDirectory(): Promise<string[] | null>;

  /**
   * Show a native save file dialog (Electron-only).
   *
   * @param options - Optional save dialog options.
   * @returns The selected save path, or `null` if cancelled.
   */
  showSaveFile(options?: PluginFileDialogSaveOptions): Promise<string | null>;
}
