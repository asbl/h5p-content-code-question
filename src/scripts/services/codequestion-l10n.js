import defaultLanguage from './default-language.json';
import defaultLanguageDe from './default-language.de.json';

const CODEQUESTION_LIBRARY = 'H5P.CodeQuestion';
const H5P_MISSING_TRANSLATION_PREFIX = '[Missing translation';

function getPreferredLocale() {
  const documentLanguage = globalThis.document?.documentElement?.lang;
  const navigatorLanguage = Array.isArray(globalThis.navigator?.languages)
    ? globalThis.navigator.languages[0]
    : globalThis.navigator?.language;

  return String(documentLanguage || navigatorLanguage || '').toLowerCase();
}

function getDefaultLibraryStrings() {
  return getPreferredLocale().startsWith('de')
    ? (defaultLanguageDe?.libraryStrings ?? defaultLanguage?.libraryStrings ?? {})
    : (defaultLanguage?.libraryStrings ?? {});
}

const DEFAULT_LIBRARY_STRINGS = getDefaultLibraryStrings();

function isMissingTranslation(message) {
  return typeof message === 'string' && message.startsWith(H5P_MISSING_TRANSLATION_PREFIX);
}

function getLibraryString(key) {
  const message = H5P.t(key, undefined, CODEQUESTION_LIBRARY);

  if (typeof message === 'string' && message !== '' && !isMissingTranslation(message)) {
    return message;
  }

  const fallback = DEFAULT_LIBRARY_STRINGS[key];
  if (typeof fallback === 'string' && fallback !== '') {
    return fallback;
  }

  throw new Error(`Missing CodeQuestion language key: ${key}`);
}

/**
 * Create a localization object that falls back to H5P library translations.
 * @param {object} l10n - Localization overrides from a concrete content type.
 * @returns {object} Localization proxy.
 */
export function createCodeQuestionL10n(l10n = {}) {
  return new Proxy(l10n, {
    get(target, key, receiver) {
      if (typeof key !== 'string') {
        return Reflect.get(target, key, receiver);
      }

      const value = Reflect.get(target, key, receiver);
      if (typeof value === 'string' && value !== '') {
        return value;
      }

      return getLibraryString(key);
    },
  });
}

/**
 * Get a required CodeQuestion string.
 * @param {object} l10n - Localization map or proxy.
 * @param {string} key - Localization key.
 * @returns {string} Localized string.
 */
export function getCodeQuestionL10nValue(l10n = {}, key) {
  const value = typeof l10n[key] === 'string' && l10n[key] !== ''
    ? l10n[key]
    : getLibraryString(key);

  if (typeof value !== 'string' || value === '') {
    throw new Error(`Missing CodeQuestion language key: ${key}`);
  }

  return value;
}

/**
 * Format a localized CodeQuestion string with placeholder replacements.
 * @param {object} l10n - Localization map or proxy.
 * @param {string} key - Localization key.
 * @param {object} replacements - Placeholder replacements.
 * @returns {string} Formatted localized string.
 */
export function tCodeQuestion(l10n = {}, key, replacements = {}) {
  let message = getCodeQuestionL10nValue(l10n, key);

  Object.keys(replacements).forEach((replacementKey) => {
    message = message.replace(
      new RegExp(`\\{${replacementKey}\\}`, 'g'),
      replacements[replacementKey],
    );
  });

  return message;
}