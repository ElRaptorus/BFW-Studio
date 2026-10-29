export { studioCodeMirrorHighlighting, studioCodeMirrorTheme } from './CodeEditorTheme';
export { createDefaultEditorExtensions, type DefaultEditorExtensionOptions } from './defaultExtensions';
export {
  createJsonAssistExtensions,
  type JsonAssistBackend,
  type JsonAssistCompletion,
  type JsonAssistDiagnostic,
  updateJsonAssist,
} from './jsonAssist';
export { jsonParseLinterExtension } from './jsonParseLinter';
export { getLanguageSupport, languageSupportIsConfigured } from './languageSupport';
export { rainbowBrackets } from './rainbowBrackets';
