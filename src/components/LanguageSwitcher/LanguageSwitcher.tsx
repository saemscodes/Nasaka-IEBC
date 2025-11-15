import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { LanguageCode } from '@/i18n';

interface LanguageSwitcherProps {
  variant?: 'splash' | 'map';
  className?: string;
}

// Custom debounce hook
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  variant = 'splash', 
  className = '' 
}) => {
  const {
    currentLanguage,
    availableLanguages,
    changeLanguage,
    isLoading
  } = useLanguage();
  
  const { theme } = useTheme();
  const { t } = useTranslation('nasaka');
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [isQuickAccessOpen, setIsQuickAccessOpen] = useState(false);
  const [isFullListOpen, setIsFullListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 200);

  // Determine variant based on current route if not explicitly set
  const effectiveVariant = variant === 'splash' 
    ? location.pathname === '/iebc-office' || location.pathname === '/nasaka-iebc'
    : variant === 'map';

  // Convert available languages to searchable array
  const languagesArray = useMemo(() => 
    Object.entries(availableLanguages).map(([code, language]) => ({
      code,
      ...language
    })), [availableLanguages]
  );

  // Filter languages based on search query with priority to current language
  const getFilteredLanguages = useCallback(() => {
    if (!debouncedSearchQuery.trim()) {
      // When no search, prioritize current language and common languages
      const priorityLanguages = ['en', 'sw', 'kik', 'luo', 'maa'];
      return languagesArray.sort((a, b) => {
        if (a.code === currentLanguage) return -1;
        if (b.code === currentLanguage) return 1;
        const aIndex = priorityLanguages.indexOf(a.code);
        const bIndex = priorityLanguages.indexOf(b.code);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
    }

    const query = debouncedSearchQuery.toLowerCase();
    return languagesArray.filter(language => 
      language.name.toLowerCase().includes(query) || 
      language.nativeName.toLowerCase().includes(query) ||
      language.code.toLowerCase().includes(query)
    );
  }, [debouncedSearchQuery, languagesArray, currentLanguage]);

  // Get top 5 languages for quick access
  const quickAccessLanguages = useMemo(() => {
    const filtered = getFilteredLanguages();
    return filtered.slice(0, 5);
  }, [getFilteredLanguages]);

  const filteredLanguages = useMemo(() => getFilteredLanguages(), [getFilteredLanguages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsQuickAccessOpen(false);
        setIsFullListOpen(false);
        setSearchQuery('');
        setIsSearchFocused(false);
      }
    };

    if (isQuickAccessOpen || isFullListOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isQuickAccessOpen, isFullListOpen]);

  // Focus search input when full list opens
  useEffect(() => {
    if (isFullListOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [isFullListOpen]);

  // Language selection handler
  const handleLanguageSelect = async (languageCode: string) => {
    const success = await changeLanguage(languageCode as LanguageCode);
    if (success) {
      setIsQuickAccessOpen(false);
      setIsFullListOpen(false);
      setSearchQuery('');
      setIsSearchFocused(false);
    }
  };

  const getLanguageFlag = (code: string) => {
    const flags: Record<string, string> = {
      en: '🇬🇧',
      sw: '🇰🇪', 
      kik: '🇰🇪',
      luo: '🇰🇪',
      maa: '🇰🇪',
      mer: '🇰🇪',
      kam: '🇰🇪',
      tai: '🇰🇪',
      kis: '🇰🇪',
      fr: '🇫🇷',
      es: '🇪🇸',
      pt: '🇵🇹',
      ar: '🇸🇦',
      zh: '🇨🇳',
      hi: '🇮🇳',
    };
    return flags[code] || '🌐';
  };

  // UPDATED: Button styles based on variant - Different shapes for splash vs map
  const buttonClass = effectiveVariant 
    ? // Splash variant - rounded-full (existing behavior)
      `w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-[#1C1C1E] shadow-[0_24px_48px_rgba(0,0,0,0.35),0_12px_24px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.1)] border-[#38383A]'
          : 'bg-white shadow-[0_24px_48px_rgba(0,0,0,0.18),0_12px_24px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] border-[#D8D8DC]'
      }`
    : // Map variant - rounded-lg to match other map controls
      `w-10 h-10 rounded-lg shadow-lg border flex items-center justify-center transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-[#1C1C1E] shadow-[0_24px_48px_rgba(0,0,0,0.35),0_12px_24px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.1)] border-[#38383A]'
          : 'bg-white shadow-[0_24px_48px_rgba(0,0,0,0.18),0_12px_24px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] border-[#D8D8DC]'
      }`;

  // Modal styles based on variant
  const modalClass = effectiveVariant
    ? `fixed top-20 right-4 w-80 rounded-2xl shadow-2xl border backdrop-blur-2xl z-50 ${
        theme === 'dark'
          ? 'bg-[#1C1C1E]/95 border-[#38383A] shadow-[0_24px_48px_rgba(0,0,0,0.35),0_12px_24px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.1)]'
          : 'bg-white/95 border-[#D8D8DC] shadow-[0_24px_48px_rgba(0,0,0,0.18),0_12px_24px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)]'
      }`
    : `fixed top-20 right-4 w-80 rounded-xl shadow-2xl border backdrop-blur-2xl z-50 ${
        theme === 'dark'
          ? 'bg-[#1C1C1E]/95 border-[#38383A] shadow-[0_24px_48px_rgba(0,0,0,0.35),0_12px_24px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.1)]'
          : 'bg-white/95 border-[#D8D8DC] shadow-[0_24px_48px_rgba(0,0,0,0.18),0_12px_24px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)]'
      }`;

  const globeVariants = {
    initial: { rotate: 0, scale: 1 },
    rotating: { 
      rotate: 360,
      scale: [1, 1.2, 1],
      transition: {
        rotate: { duration: 0.6 },
        scale: { duration: 0.6 }
      }
    },
    hover: {
      scale: 1.1,
      rotate: [0, -5, 5, 0],
      transition: {
        duration: 0.4
      }
    }
  };

  // Animation variants for modals
  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.9,
      y: -20
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 500,
        duration: 0.3
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9,
      y: -20,
      transition: {
        duration: 0.2
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim() && filteredLanguages.length > 0) {
      handleLanguageSelect(filteredLanguages[0].code);
    }
  };

  // Text colors based on theme
  const textPrimary = theme === 'dark' ? 'text-[#FFFFFF]' : 'text-[#1C1C1E]';
  const textSecondary = theme === 'dark' ? 'text-[#EBEBF5]' : 'text-[#3C3C43]';
  const textTertiary = theme === 'dark' ? 'text-[#EBEBF5]' : 'text-[#3C3C43]';
  
  // Background colors based on theme
  const bgSurfaceHover = theme === 'dark' ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]';
  const bgSurface = theme === 'dark' ? 'bg-[#1C1C1E]' : 'bg-white';
  
  // Border colors based on theme
  const borderColor = theme === 'dark' ? 'border-[#38383A]' : 'border-[#D8D8DC]';

  return (
    <div className={`relative ${className}`}>
      {/* Main language button */}
      <motion.button
        ref={buttonRef}
        whileHover="hover"
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsQuickAccessOpen(true)}
        className={buttonClass}
        disabled={isLoading}
        aria-label={t('common.changeLanguage', 'Change language')}
      >
        <motion.div
          variants={globeVariants}
          initial="initial"
          animate={isLoading ? "rotating" : "initial"}
        >
          <Globe className={`w-5 h-5 ${theme === 'dark' ? 'text-[#FFFFFF]' : 'text-[#1C1C1E]'}`} />
        </motion.div>
      </motion.button>

      {/* QUICK ACCESS MODAL - 5 Languages */}
      <AnimatePresence>
        {isQuickAccessOpen && (
          <>
            {/* Enhanced Backdrop Overlay */}
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                background: theme === 'dark' 
                  ? 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.6) 100%)'
                  : 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.6) 100%)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
              }}
              onClick={() => {
                setIsQuickAccessOpen(false);
                setSearchQuery('');
              }}
            />
            
            {/* Quick Access Modal */}
            <motion.div
              ref={dropdownRef}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={modalClass}
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-semibold text-base ${textPrimary}`}>
                    Quick Access
                  </h3>
                  <span className={`text-xs ${textTertiary} ${bgSurfaceHover} px-2 py-1 rounded-full`}>
                    {quickAccessLanguages.length}/5
                  </span>
                </div>

                {/* Quick Access Languages */}
                <div className="space-y-2 mb-4">
                  {quickAccessLanguages.map((language) => (
                    <motion.button
                      key={language.code}
                      whileHover={{ 
                        backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,122,255,0.08)'
                      }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleLanguageSelect(language.code)}
                      className={`w-full flex items-center px-3 py-3 rounded-xl text-left transition-all ${
                        currentLanguage === language.code 
                          ? theme === 'dark' 
                            ? 'bg-blue-500 text-white shadow-lg' 
                            : 'bg-blue-500 text-white shadow-lg'
                          : `hover:${bgSurfaceHover}`
                      }`}
                    >
                      <span className="text-xl mr-3">{getLanguageFlag(language.code)}</span>
                      <div className="flex-1">
                        <div className={`font-medium text-sm ${
                          currentLanguage === language.code ? 'text-white' : textPrimary
                        }`}>
                          {language.nativeName}
                        </div>
                        <div className={`text-xs ${
                          currentLanguage === language.code ? 'text-blue-100' : textSecondary
                        }`}>
                          {language.name}
                        </div>
                      </div>
                      {currentLanguage === language.code && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center"
                        >
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Search All Languages Button */}
                <motion.button
                  whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setIsQuickAccessOpen(false);
                    setIsFullListOpen(true);
                  }}
                  className={`w-full flex items-center justify-center px-3 py-3 rounded-xl ${borderColor} text-sm font-medium text-blue-500 dark:text-blue-400 transition-colors hover:${bgSurfaceHover}`}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search All Languages ({languagesArray.length})
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FULL LANGUAGE LIST MODAL - With Enhanced Search */}
      <AnimatePresence>
        {isFullListOpen && (
          <>
            {/* Enhanced Backdrop Overlay */}
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                background: theme === 'dark' 
                  ? 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.6) 100%)'
                  : 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.6) 100%)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
              }}
              onClick={() => {
                setIsFullListOpen(false);
                setSearchQuery('');
                setIsSearchFocused(false);
              }}
            />
            
            {/* Full Language List Modal */}
            <motion.div
              ref={dropdownRef}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={`${modalClass} max-h-96 overflow-hidden flex flex-col`}
            >
              {/* Search Header */}
              <div className={`p-4 border-b ${borderColor}`}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className={`h-4 w-4 transition-colors duration-300 ${textSecondary}`} />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    onKeyPress={handleKeyPress}
                    className={`w-full pl-10 pr-10 py-3 ${bgSurfaceHover} border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1C1C1E] transition-colors duration-300 ${textPrimary} placeholder-${textTertiary}`}
                    placeholder="Search languages..."
                    style={{ 
                      caretColor: theme === 'dark' ? '#FFFFFF' : '#1C1C1E'
                    }}
                  />
                  {searchQuery && (
                    <motion.button
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      onClick={handleClearSearch}
                      className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors duration-300 ${textSecondary} hover:${textPrimary}`}
                    >
                      <X className="h-4 w-4" />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Language List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                  <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${textTertiary} flex justify-between items-center`}>
                    <span>
                      {searchQuery ? 'Search Results' : 'All Languages'}
                    </span>
                    <span className="text-xs opacity-70">
                      {filteredLanguages.length} languages
                    </span>
                  </div>
                  
                  {filteredLanguages.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-center py-8 ${textTertiary}`}
                    >
                      <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${bgSurfaceHover}`}>
                        <Search className="w-6 h-6 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">No languages found</p>
                      <p className="text-xs mt-1">Try a different search term</p>
                    </motion.div>
                  ) : (
                    filteredLanguages.map((language, index) => (
                      <motion.button
                        key={language.code}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ 
                          delay: index * 0.02,
                          type: "spring",
                          stiffness: 400,
                          damping: 25
                        }}
                        whileHover={{ 
                          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,122,255,0.08)'
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleLanguageSelect(language.code)}
                        className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all ${
                          currentLanguage === language.code 
                            ? theme === 'dark' 
                              ? 'bg-blue-500 text-white shadow-lg' 
                              : 'bg-blue-500 text-white shadow-lg'
                            : ''
                        }`}
                      >
                        <span className="text-xl mr-3">{getLanguageFlag(language.code)}</span>
                        <div className="flex-1">
                          <div className={`font-medium text-sm ${
                            currentLanguage === language.code ? 'text-white' : textPrimary
                          }`}>
                            {language.nativeName}
                          </div>
                          <div className={`text-xs ${
                            currentLanguage === language.code ? 'text-blue-100' : textSecondary
                          }`}>
                            {language.name}
                          </div>
                        </div>
                        {currentLanguage === language.code && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center"
                          >
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))
                  )}
                </div>
              </div>

              {/* Footer with Keyboard Hint */}
              {filteredLanguages.length > 0 && searchQuery && (
                <div className={`p-3 border-t transition-all duration-300 ${borderColor} ${theme === 'dark' ? 'bg-[#1C1C1E]/80' : 'bg-white/90'}`}>
                  <div className={`text-sm text-center transition-colors duration-300 ${textTertiary}`}>
                    Press <kbd className={`px-2 py-1 border rounded text-sm font-mono transition-all duration-300 ${
                      theme === 'dark'
                        ? 'bg-[#1C1C1E] border-[#38383A] text-[#EBEBF5] shadow-lg'
                        : 'bg-white border-[#D8D8DC] text-[#3C3C43] shadow-md'
                    }`}>Enter</kbd> to select first result
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className={`p-3 border-t ${borderColor}`}>
                <motion.button
                  whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setIsFullListOpen(false);
                    setSearchQuery('');
                    setIsSearchFocused(false);
                  }}
                  className={`w-full py-3 text-sm font-medium rounded-xl transition-colors duration-300 ${textSecondary} ${bgSurfaceHover} hover:opacity-80`}
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Enhanced CSS for iOS-style glassmorphism */}
      <style jsx>{`
        /* Enhanced glassmorphism with better backdrop support */
        .backdrop-blur-2xl {
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
        }

        /* Enhanced scrollbar */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
          background: ${theme === 'dark' ? 'rgba(44, 44, 46, 0.4)' : 'rgba(242, 242, 247, 0.8)'};
          border-radius: 3px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? 'rgba(120, 120, 128, 0.6)' : 'rgba(174, 174, 178, 0.6)'};
          border-radius: 3px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'dark' ? 'rgba(150, 150, 160, 0.8)' : 'rgba(142, 142, 147, 0.8)'};
        }

        /* Input styling */
        input {
          color: ${theme === 'dark' ? '#FFFFFF' : '#1C1C1E'} !important;
          caret-color: ${theme === 'dark' ? '#FFFFFF' : '#1C1C1E'} !important;
        }

        input::placeholder {
          color: ${theme === 'dark' ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)'} !important;
        }
      `}</style>
    </div>
  );
};

export default LanguageSwitcher;
