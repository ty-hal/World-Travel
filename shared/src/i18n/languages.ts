export const SUPPORTED_LANGUAGES = [{ value: 'en', label: 'English', locale: 'en-US' }] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['value'];

export const SUPPORTED_LANGUAGE_CODES: string[] = SUPPORTED_LANGUAGES.map((l) => l.value);

const LOCALES: Partial<Record<string, string>> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.value, l.locale]),
);

const RTL_LANGUAGES = new Set<string>();

export function getLocaleForLanguage(language: string): string {
  return LOCALES[language] ?? LOCALES['en'] ?? 'en-US';
}

// Returns a BCP-47 tag suitable for Intl APIs.
export function getIntlLanguage(language: string): string {
  if (language === 'br') return 'pt-BR';
  return SUPPORTED_LANGUAGE_CODES.includes(language) ? language : 'en';
}

export function isRtlLanguage(language: string): boolean {
  return RTL_LANGUAGES.has(language);
}
