import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Supported languages with their native names
export const SUPPORTED_LANGUAGES = {
  en: { code: 'en', name: 'English', nativeName: 'English' },
  sw: { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  kik: { code: 'kik', name: 'Kikuyu', nativeName: 'Gĩkũyũ' },
};

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// Dynamic language detection that auto-discovers new languages
const dynamicLanguageDetector = {
  type: 'languageDetector' as const,
  async: true,
  init: () => {},
  detect: (callback: (lng: string) => void) => {
    const savedLanguage = localStorage.getItem('nasaka_language');
    if (savedLanguage && SUPPORTED_LANGUAGES[savedLanguage as LanguageCode]) {
      return callback(savedLanguage);
    }

    const browserLanguage = navigator.language.split('-')[0];
    if (SUPPORTED_LANGUAGES[browserLanguage as LanguageCode]) {
      return callback(browserLanguage);
    }

    callback('en');
  },
  cacheUserLanguage: (lng: string) => {
    localStorage.setItem('nasaka_language', lng);
  }
};

i18n
  .use(dynamicLanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: Object.keys(SUPPORTED_LANGUAGES),
    defaultNS: 'nasaka',
    ns: ['nasaka'],
    
    // Enhanced interpolation settings
    interpolation: {
      escapeValue: false,
      nestingPrefix: '{{',
      nestingSuffix: '}}',
      alwaysFormat: true,
      format: (value, format, lng) => {
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        if (format === 'capitalize') return value.charAt(0).toUpperCase() + value.slice(1);
        return value;
      }
    },

    // Enhanced error handling
    saveMissing: false,
    parseMissingKeyHandler: (key: string) => {
      console.warn(`Translation key missing: ${key}`);
      // Return the key itself but formatted nicely for development
      if (process.env.NODE_ENV === 'development') {
        return `[${key}]`;
      }
      // In production, try to extract the last part of the key
      const parts = key.split('.');
      return parts[parts.length - 1];
    },

    // Performance optimizations
    react: {
      useSuspense: true,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p', 'span'],
    },

    // Detection settings
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'nasaka_language',
      checkWhitelist: true
    }
  });

// Function to dynamically load a language
export const loadLanguage = async (lng: LanguageCode) => {
  try {
    // Try to load the language file
    const response = await fetch(`/locales/${lng}/nasaka.json`);
    
    if (!response.ok) {
      throw new Error(`Language ${lng} not found`);
    }

    const resources = await response.json();
    
    // Add the loaded resources to i18n
    i18n.addResourceBundle(lng, 'nasaka', resources, true, true);
    
    // Update supported languages if it's a new one
    if (!SUPPORTED_LANGUAGES[lng]) {
      SUPPORTED_LANGUAGES[lng] = {
        code: lng,
        name: lng.toUpperCase(),
        nativeName: lng.toUpperCase()
      };
    }
    
    return true;
  } catch (error) {
    console.warn(`Failed to load language ${lng}:`, error);
    return false;
  }
};

// Preload all supported languages on startup
export const preloadLanguages = async () => {
  const languages = Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[];
  
  for (const lng of languages) {
    if (lng !== 'en') { // English is already loaded
      await loadLanguage(lng);
    }
  }
};

// Initialize language loading
preloadLanguages().catch(console.error);

export default i18n;
