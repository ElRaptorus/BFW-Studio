import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import type { Extension } from '@codemirror/state';

/**
 * Language ids the host wrappers actually pass.
 * Unknown ids and plaintext return an empty extension (no throw).
 *
 * `html` is HTML (Machine Sanctum playground). XML inspectors must pass `xml`.
 */
const LANGUAGE_SUPPORT: Record<string, () => Extension> = {
  json: () => json(),
  javascript: () => javascript(),
  html: () => html(),
  xml: () => xml(),
};

export function getLanguageSupport(language: string | undefined): Extension {
  if (language == null || language === '' || language === 'plaintext') {
    return [];
  }
  const factory = LANGUAGE_SUPPORT[language.toLowerCase()];
  if (factory == null) {
    return [];
  }
  return factory();
}

export function languageSupportIsConfigured(language: string): boolean {
  const extension = getLanguageSupport(language);
  if (Array.isArray(extension)) {
    return extension.length > 0;
  }
  return extension != null;
}
