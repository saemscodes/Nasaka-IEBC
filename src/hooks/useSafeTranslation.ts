import { useTranslation } from 'react-i18next';

export const useSafeTranslation = (namespace: string = 'nasaka') => {
  const { t, i18n, ready } = useTranslation(namespace);

  // Safe translation function that prevents key leaks and undefined errors
  const safeT = (key: string, defaultValue?: string, options?: any) => {
    if (!ready || !key) {
      return defaultValue || '';
    }

    try {
      const translation = t(key, options);
      
      // Ensure translation is a string
      if (typeof translation !== 'string') {
        console.warn(`Translation for key "${key}" is not a string:`, translation);
        return defaultValue || '';
      }
      
      // If the translation returns the key (meaning it wasn't found), return defaultValue or formatted key
      if (translation === key) {
        if (defaultValue) return defaultValue;
        
        // Format the key for a more user-friendly fallback
        const parts = key.split('.');
        const lastPart = parts[parts.length - 1];
        const formatted = lastPart
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .trim();
        
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
      }
      
      return translation;
    } catch (error) {
      console.error(`Error translating key "${key}":`, error);
      return defaultValue || '';
    }
  };

  return {
    t: safeT,
    i18n,
    ready,
    currentLanguage: i18n.language
  };
};
