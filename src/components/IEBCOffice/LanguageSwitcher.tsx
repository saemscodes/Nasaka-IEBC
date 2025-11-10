import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const { theme } = useTheme();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'sw' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleLanguage}
      className={`w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-ios-gray-800 shadow-ios-gray-900/50 border-ios-gray-600'
          : 'bg-white shadow-ios-gray-200/50 border-ios-gray-200'
      }`}
      aria-label={`Switch to ${i18n.language === 'en' ? 'Swahili' : 'English'}`}
    >
      <span className={`text-sm font-bold transition-colors duration-300 ${
        theme === 'dark' ? 'text-white' : 'text-ios-gray-900'
      }`}>
        {i18n.language === 'en' ? 'SW' : 'EN'}
      </span>
    </motion.button>
  );
};

export default LanguageSwitcher;
