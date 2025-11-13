// Utility for auto-discovering new languages in the locales folder
export const discoverLanguages = async (): Promise<string[]> => {
  try {
    // In a real implementation, this would fetch available languages from an API
    // or scan the filesystem. For now, we'll return our predefined languages.
    const availableLanguages = ['en', 'sw', 'kik', 'luo'];
    
    // You could extend this to fetch from an API endpoint that lists available languages
    // const response = await fetch('/api/languages');
    // const availableLanguages = await response.json();
    
    return availableLanguages;
  } catch (error) {
    console.warn('Language discovery failed:', error);
    return ['en']; // Always fall back to English
  }
};

// Function to validate a language file structure
export const validateLanguageFile = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false;
  
  // Check for required top-level namespaces
  const requiredNamespaces = ['common', 'splash', 'search', 'office'];
  return requiredNamespaces.every(ns => data[ns] && typeof data[ns] === 'object');
};

// Function to merge missing keys from fallback language
export const mergeWithFallback = (target: any, fallback: any): any => {
  if (typeof target !== 'object' || typeof fallback !== 'object') {
    return target || fallback;
  }

  const result = { ...target };
  
  for (const key in fallback) {
    if (!(key in result)) {
      result[key] = fallback[key];
    } else if (typeof fallback[key] === 'object' && !Array.isArray(fallback[key])) {
      result[key] = mergeWithFallback(result[key], fallback[key]);
    }
  }
  
  return result;
};
