/**
 *  Returns the correct keystroke
 *
 * @param valueForMacOs Keystroke on macOS e.g. cmd-shift-j
 * @param valueForWindows Keystroke on Windows e.g. ctrl-shift-j
 * @param valueForLinux Optional: Keystroke on Linux. If not given, the Windows keystroke is used.
 */
export function OsSpecificKeystroke(valueForMacOs: string, valueForWindows: string, valueForLinux?: string) {
  switch (process.platform) {
    case 'darwin':
      return valueForMacOs;
    case 'win32':
      return valueForWindows;
    case 'linux':
      return valueForLinux || valueForWindows;
    default:
      return valueForWindows;
  }
}
