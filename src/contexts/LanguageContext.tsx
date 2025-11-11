import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, LanguageCode, loadLanguage } from '@/i18n';

interface LanguageContextType {
  currentLanguage: LanguageCode;
  availableLanguages: typeof SUPPORTED_LANGUAGES;
  changeLanguage: (lng: LanguageCode) => Promise<boolean>;
  isLoading: boolean;
  isDropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState(SUPPORTED_LANGUAGES);

  // Sync with i18n language changes - FIXED IMPLEMENTATION
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      console.log('i18n language changed to:', lng);
      const languageCode = lng.split('-')[0] as LanguageCode;
      if (SUPPORTED_LANGUAGES[languageCode]) {
        setCurrentLanguage(languageCode);
        console.log('Context language updated to:', languageCode);
      } else {
        setCurrentLanguage('en');
        console.log('Context language fallback to English');
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);
    
    // Set initial language
    const currentLang = i18n.language || 'en';
    const languageCode = currentLang.split('-')[0] as LanguageCode;
    const initialLanguage = SUPPORTED_LANGUAGES[languageCode] ? languageCode : 'en';
    setCurrentLanguage(initialLanguage);
    console.log('Initial language set to:', initialLanguage);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  // FIXED: Language change function
  const changeLanguage = useCallback(async (lng: LanguageCode): Promise<boolean> => {
    if (lng === currentLanguage) {
      console.log('Language already set to:', lng);
      return true;
    }
    
    console.log('Starting language change to:', lng);
    setIsLoading(true);
    
    try {
      // Ensure the language is loaded
      const success = await loadLanguage(lng);
      if (success) {
        console.log('Language loaded successfully, changing i18n language...');
        
        // Actually change the language in i18n - THIS WAS MISSING!
        await i18n.changeLanguage(lng);
        
        setDropdownOpen(false);
        console.log('Language change completed successfully to:', lng);
        return true;
      } else {
        console.warn(`Failed to load language: ${lng}`);
        return false;
      }
    } catch (error) {
      console.error('Language change error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentLanguage, i18n]);

  // Auto-discover new languages on mount
  useEffect(() => {
    const initializeLanguages = async () => {
      try {
        console.log('Initializing language context...');
        // You could update availableLanguages here if new languages are discovered
      } catch (error) {
        console.warn('Language initialization failed:', error);
      }
    };

    initializeLanguages();
  }, []);

  const value: LanguageContextType = {
    currentLanguage,
    availableLanguages,
    changeLanguage,
    isLoading,
    isDropdownOpen,
    setDropdownOpen
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
