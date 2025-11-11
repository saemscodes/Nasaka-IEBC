import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, LanguageCode, loadLanguage } from '@/i18n/index.ts';

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

  // Sync with i18n language changes
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const languageCode = lng.split('-')[0] as LanguageCode;
      if (SUPPORTED_LANGUAGES[languageCode]) {
        setCurrentLanguage(languageCode);
      } else {
        setCurrentLanguage('en');
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);
    
    // Set initial language
    handleLanguageChanged(i18n.language);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  const changeLanguage = useCallback(async (lng: LanguageCode): Promise<boolean> => {
    if (lng === currentLanguage) return true;
    
    setIsLoading(true);
    try {
      // Ensure the language is loaded
      const success = await loadLanguage(lng);
      if (success) {
        await i18n.changeLanguage(lng);
        setDropdownOpen(false);
        return true;
      } else {
        console.warn(`Failed to change to language: ${lng}`);
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
    const discoverLanguages = async () => {
      try {
        // This would typically fetch available languages from an API
        // For now, we'll work with our predefined languages
        console.log('Language discovery initialized');
      } catch (error) {
        console.warn('Language discovery failed:', error);
      }
    };

    discoverLanguages();
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
