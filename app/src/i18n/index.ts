import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import hr from './locales/hr.json';

export const LOCALE_STORAGE_KEY = '@cafe-social/locale';

const resources = {
  en: { translation: en },
  de: { translation: de },
  es: { translation: es },
  hr: { translation: hr },
} as const;

export type AppLanguage = keyof typeof resources;

export const LANGUAGE_OPTIONS: { code: AppLanguage; nativeName: string }[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'es', nativeName: 'Español' },
  { code: 'hr', nativeName: 'Hrvatski' },
];

export function isAppLanguage(code: string): code is AppLanguage {
  return Object.prototype.hasOwnProperty.call(resources, code);
}

export async function initI18n(): Promise<void> {
  let lng: AppLanguage = 'en';
  try {
    const saved = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && isAppLanguage(saved)) {
      lng = saved;
    } else {
      const device = Localization.getLocales()[0]?.languageCode ?? 'en';
      if (isAppLanguage(device)) lng = device;
    }
  } catch {
    /* keep en */
  }

  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: resources as unknown as Record<string, { translation: Record<string, unknown> }>,
      lng,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
    return;
  }

  await i18n.changeLanguage(lng);
}

export async function setAppLanguage(code: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, code);
  await i18n.changeLanguage(code);
}

export default i18n;
