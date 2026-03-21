import { isAppLanguage, type AppLanguage } from '../i18n';

/** Languages we seed in the word DB (matches CreateWordMatchDto). */
export function toApiWordLanguage(i18nLng: string): AppLanguage {
  const base = i18nLng?.split('-')[0]?.toLowerCase() ?? 'en';
  if (isAppLanguage(base)) return base;
  return 'en';
}
