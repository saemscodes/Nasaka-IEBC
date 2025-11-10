// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en/nasaka.json';
import sw from './locales/sw/nasaka.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        nasaka: en
      },
      sw: {
        nasaka: sw
      }
    },
    fallbackLng: 'en',
    defaultNS: 'nasaka',
    ns: ['nasaka'],
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'nasaka_language'
    }
  });

export default i18n;
