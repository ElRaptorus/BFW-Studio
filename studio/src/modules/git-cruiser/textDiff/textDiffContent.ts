const MAXIMUM_TEXT_DIFF_CHARACTERS = 2 * 1024 * 1024;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  json: 'json',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'javascript',
  tsx: 'javascript',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  bpmn: 'xml',
  dmn: 'xml',
  bfwsln: 'xml',
};

/**
 * Returns the CodeMirror language id for a file path, or `plaintext` for an unknown extension.
 */
export function getTextDiffLanguage(filePath: string): string {
  const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
  const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase() : '';
  return LANGUAGE_BY_EXTENSION[extension] ?? 'plaintext';
}

/**
 * A side can be compared as text when it holds no NUL character (binary) and is not larger than 2 million characters.
 */
export function canCompareAsText(text: string): boolean {
  return text.length <= MAXIMUM_TEXT_DIFF_CHARACTERS && !text.includes('\u0000');
}
