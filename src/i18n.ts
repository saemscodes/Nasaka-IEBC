import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { LANGUAGES } from './i18n/languages.generated';

// Dynamic import function for language files
const loadLanguageResource = async (langCode: string) => {
  try {
    const module = await import(`./locales/${langCode}/nasaka.json`);
    return module.default || module;
  } catch (error) {
    console.warn(`Failed to load language ${langCode}:`, error);
    // Fallback to English if language file doesn't exist
    if (langCode !== 'en') {
      const enModule = await import('./locales/en/nasaka.json');
      return enModule.default || enModule;
    }
    return {};
  }
};

// Initialize i18n with dynamic language loading
const initializeI18n = async () => {
  const resources: Record<string, any> = {};

  // Load all languages dynamically
  const loadPromises = LANGUAGES.map(async (lang) => {
    const resource = await loadLanguageResource(lang.code);
    resources[lang.code] = {
      nasaka: resource
    };
  });

  await Promise.all(loadPromises);

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
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
      },
      react: {
        useSuspense: false
      }
    });
};

// Initialize i18n
initializeI18n().catch(console.error);

export default i18n;
