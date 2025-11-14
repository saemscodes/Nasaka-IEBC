import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { LanguageCode } from '@/i18n';

interface LanguageSwitcherProps {
  variant?: 'splash' | 'map';
  className?: string;
}

// Debounce hook for search optimization [citation:8]
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
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // 300ms debounce delay [citation:8]

  // Determine variant based on current route if not explicitly set
  const effectiveVariant = variant === 'splash' 
    ? location.pathname === '/iebc-office' || location.pathname === '/nasaka-iebc'
    : variant === 'map';

  // Close dropdown when clicking outside [citation:6]
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsQuickAccessOpen(false);
        setIsFullListOpen(false);
        setSearchQuery('');
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
      }, 100);
    }
  }, [isFullListOpen]);

  // Language selection handler
  const handleLanguageSelect = async (languageCode: string) => {
    const success = await changeLanguage(languageCode as LanguageCode);
    if (success) {
      setIsQuickAccessOpen(false);
      setIsFullListOpen(false);
      setSearchQuery('');
    }
  };

  // Get top 5 most used languages for quick access (prioritizing current language)
  const getQuickAccessLanguages = () => {
    const languagePriority = [currentLanguage, 'en', 'sw', 'kik', 'luo'];
    const uniquePriority = [...new Set(languagePriority)];
    
    return Object.entries(availableLanguages)
      .sort(([a], [b]) => {
        const aIndex = uniquePriority.indexOf(a);
        const bIndex = uniquePriority.indexOf(b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      })
      .slice(0, 5);
  };

  // Filter languages based on search query [citation:3]
  const getFilteredLanguages = () => {
    if (!debouncedSearchQuery) {
      return Object.entries(availableLanguages);
    }

    const query = debouncedSearchQuery.toLowerCase();
    return Object.entries(availableLanguages).filter(([code, language]) => 
      language.name.toLowerCase().includes(query) || 
      language.nativeName.toLowerCase().includes(query) ||
      code.toLowerCase().includes(query)
    );
  };

  const quickAccessLanguages = getQuickAccessLanguages();
  const filteredLanguages = getFilteredLanguages();

  const getLanguageFlag = (code: string) => {
    const flags: Record<string, string> = {
      en: '🇬🇧',
      sw: '🇰🇪', 
      kik: '🇰🇪',
      luo: '🇰🇪',
    };
    return flags[code] || '🌐';
  };

  // Button styles based on variant - iOS inspired design
  const buttonClass = effectiveVariant 
    ? `w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-ios-gray-800 shadow-ios-gray-900/50 border-ios-gray-600'
          : 'bg-white shadow-ios-gray-200/50 border-ios-gray-200'
      }`
    : `w-10 h-10 rounded-lg shadow-lg border flex items-center justify-center transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-ios-gray-800 shadow-ios-gray-900/50 border-ios-gray-600'
          : 'bg-white shadow-ios-gray-200/50 border-ios-gray-200'
      }`;

  // Modal styles based on variant - iOS inspired design
  const modalClass = effectiveVariant
    ? `absolute top-12 right-0 w-72 rounded-2xl shadow-xl border backdrop-blur-lg z-50 ${
        theme === 'dark'
          ? 'bg-ios-gray-800/95 border-ios-gray-600 text-white'
          : 'bg-white/95 border-ios-gray-200 text-ios-gray-900'
      }`
    : `absolute top-12 right-0 w-72 rounded-xl shadow-xl border backdrop-blur-lg z-50 ${
        theme === 'dark'
          ? 'bg-ios-gray-800/95 border-ios-gray-600 text-white'
          : 'bg-white/95 border-ios-gray-200 text-ios-gray-900'
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

  // Animation variants for modals [citation:7]
  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.9,
      y: -8
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 500,
        duration: 0.2
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9,
      y: -8,
      transition: {
        duration: 0.15
      }
    }
  };

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
          <svg 
            className="w-5 h-5" 
            fill="currentColor" 
            viewBox="0 0 30 30"
          >
            <path d="M 15 3 C 8.3844276 3 3 8.38443 3 15 C 3 21.61557 8.3844276 27 15 27 C 21.615572 27 27 21.61557 27 15 C 27 8.38443 21.615572 3 15 3 z M 15 5 C 15.180732 5 15.437682 5.095605 15.798828 5.515625 C 16.159974 5.935695 16.554657 6.6459131 16.888672 7.5644531 C 17.115929 8.1894125 17.304067 8.9365703 17.470703 9.7304688 C 16.703865 9.8785271 15.876434 9.9726562 15 9.9726562 C 14.123023 9.9726562 13.296096 9.8786981 12.529297 9.7304688 C 12.695933 8.9365703 12.884071 8.1894125 13.111328 7.5644531 C 13.445343 6.6459131 13.840026 5.935695 14.201172 5.515625 C 14.562318 5.095565 14.819268 5 15 5 z M 18.177734 5.5273438 C 19.440264 5.9517667 20.593097 6.6119807 21.574219 7.46875 C 21.366969 7.940571 20.863197 8.4539899 19.978516 8.9140625 C 19.80473 9.0044394 19.595144 9.080595 19.398438 9.1621094 C 19.219955 8.3461149 19.017233 7.5674091 18.767578 6.8808594 C 18.589626 6.3914913 18.39284 5.9423147 18.177734 5.5273438 z M 11.820312 5.5292969 C 11.605676 5.9436531 11.410049 6.3923842 11.232422 6.8808594 C 10.982991 7.5667918 10.781906 8.345 10.603516 9.1601562 C 10.407143 9.0787293 10.197012 9.0043297 10.023438 8.9140625 C 9.1387547 8.4539899 8.6349848 7.940571 8.4277344 7.46875 C 9.4080415 6.6129419 10.559365 5.9538637 11.820312 5.5292969 z M 7.015625 8.9882812 C 7.5214194 9.6734654 8.2551269 10.247316 9.1015625 10.6875 C 9.4599876 10.873898 9.8490096 11.03711 10.253906 11.185547 C 10.137722 12.08094 10.0662 13.022574 10.035156 14 L 5.0488281 14 C 5.2340606 12.125261 5.9434897 10.411484 7.015625 8.9882812 z M 22.986328 8.9902344 C 24.057534 10.413013 24.766034 12.12622 24.951172 14 L 19.964844 14 C 19.9338 13.022574 19.862278 12.08094 19.746094 11.185547 C 20.151204 11.037095 20.541919 10.873922 20.900391 10.6875 C 21.746291 10.247594 22.480555 9.6748411 22.986328 8.9902344 z M 12.210938 11.703125 C 13.091093 11.8684 14.02009 11.972656 15 11.972656 C 15.979105 11.972656 16.909116 11.870089 17.789062 11.705078 C 17.87699 12.437782 17.934937 13.202467 17.962891 14 L 12.037109 14 C 12.065087 13.201772 12.122886 12.4364 12.210938 11.703125 z M 5.0488281 16 L 10.035156 16 C 10.065402 16.952275 10.134934 17.869416 10.246094 18.744141 C 9.8442815 18.891786 9.4573931 19.053233 9.1015625 19.238281 C 8.2400662 19.686299 7.4949739 20.273273 6.9882812 20.974609 C 5.9317731 19.558613 5.2324623 17.858562 5.0488281 16 z M 12.037109 16 L 17.962891 16 C 17.935852 16.771422 17.882121 17.511531 17.798828 18.222656 C 16.916823 18.056457 15.984298 17.953243 15.001953 17.953125 L 15 17.953125 C 14.017654 17.953243 13.085547 18.056457 12.203125 18.222656 C 12.119818 17.511466 12.064151 16.771501 12.037109 16 z M 19.964844 16 L 24.951172 16 C 24.767538 17.858562 24.068227 19.558613 23.011719 20.974609 C 22.505026 20.273273 21.759933 19.686299 20.898438 19.238281 C 20.542607 19.053233 20.155565 18.891786 19.753906 18.744141 C 19.865066 17.869416 19.934598 16.952275 19.964844 16 z M 15 19.953125 C 15.882043 19.953125 16.713979 20.047437 17.484375 20.197266 C 17.314908 21.019302 17.122694 21.791984 16.888672 22.435547 C 16.554657 23.354087 16.159974 24.064305 15.798828 24.484375 C 15.437682 24.904435 15.180732 25 15 25 C 14.819268 25 14.562318 24.904395 14.201172 24.484375 C 13.840026 24.064305 13.445343 23.354087 13.111328 22.435547 C 12.877306 21.791984 12.685092 21.019302 12.515625 20.197266 C 13.28606 20.047611 14.118507 19.953125 15 19.953125 z M 10.589844 20.769531 C 10.77107 21.610927 10.975985 22.413943 11.232422 23.119141 C 11.410049 23.607616 11.605676 24.056347 11.820312 24.470703 C 10.547922 24.0423 9.3864034 23.374862 8.4003906 22.507812 C 8.5948402 22.022275 9.1057924 21.487923 10.021484 21.011719 C 10.191668 20.923215 10.397657 20.84955 10.589844 20.769531 z M 19.410156 20.771484 C 19.601393 20.851209 19.807085 20.923582 19.976562 21.011719 C 20.893482 21.488559 21.403801 22.02371 21.597656 22.509766 C 20.611788 23.376206 19.451682 24.042657 18.179688 24.470703 C 18.394324 24.056347 18.589951 23.607616 18.767578 23.119141 C 19.023827 22.414458 19.229004 21.612176 19.410156 20.771484 z" />
          </svg>
        </motion.div>
      </motion.button>

      {/* QUICK ACCESS MODAL - 5 Languages */}
      <AnimatePresence>
        {isQuickAccessOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-ios-gray-600 dark:text-ios-gray-400">
                    Quick Access
                  </h3>
                  <span className="text-xs text-ios-gray-500 dark:text-ios-gray-500 bg-ios-gray-100 dark:bg-ios-gray-800 px-2 py-1 rounded-full">
                    {quickAccessLanguages.length}/5
                  </span>
                </div>

                {/* Quick Access Languages */}
                <div className="space-y-1 mb-3">
                  {quickAccessLanguages.map(([code, language]) => (
                    <motion.button
                      key={code}
                      whileHover={{ 
                        backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,122,255,0.08)'
                      }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleLanguageSelect(code)}
                      className={`w-full flex items-center px-3 py-2.5 rounded-xl text-left transition-all ${
                        currentLanguage === code 
                          ? theme === 'dark' 
                            ? 'bg-blue-500 text-white shadow-sm' 
                            : 'bg-blue-500 text-white shadow-sm'
                          : 'hover:bg-ios-gray-100 dark:hover:bg-ios-gray-700'
                      }`}
                    >
                      <span className="text-lg mr-3">{getLanguageFlag(code)}</span>
                      <div className="flex-1">
                        <div className={`font-medium text-sm ${
                          currentLanguage === code ? 'text-white' : 'text-ios-gray-900 dark:text-white'
                        }`}>
                          {language.nativeName}
                        </div>
                        <div className={`text-xs ${
                          currentLanguage === code ? 'text-blue-100' : 'text-ios-gray-500 dark:text-ios-gray-400'
                        }`}>
                          {language.name}
                        </div>
                      </div>
                      {currentLanguage === code && (
                        <svg className="w-4 h-4 ml-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* View All Languages Button */}
                <motion.button
                  whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setIsQuickAccessOpen(false);
                    setIsFullListOpen(true);
                  }}
                  className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl border border-ios-gray-200 dark:border-ios-gray-600 text-sm font-medium text-blue-500 dark:text-blue-400 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search All Languages ({Object.keys(availableLanguages).length})
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FULL LANGUAGE LIST MODAL - With Search */}
      <AnimatePresence>
        {isFullListOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => {
                setIsFullListOpen(false);
                setSearchQuery('');
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
              <div className="p-4 border-b border-ios-gray-200 dark:border-ios-gray-600">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-ios-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-ios-gray-100 dark:bg-ios-gray-800 border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-ios-gray-700 transition-colors"
                    placeholder="Search languages..."
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <svg className="h-4 w-4 text-ios-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Language List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ios-gray-500 dark:text-ios-gray-400 flex justify-between items-center">
                    <span>
                      {searchQuery ? 'Search Results' : 'All Languages'}
                    </span>
                    <span className="text-xs opacity-70">
                      {filteredLanguages.length} languages
                    </span>
                  </div>
                  
                  {filteredLanguages.length === 0 ? (
                    <div className="text-center py-8 text-ios-gray-500 dark:text-ios-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm">No languages found</p>
                      <p className="text-xs mt-1">Try a different search term</p>
                    </div>
                  ) : (
                    filteredLanguages.map(([code, language]) => (
                      <motion.button
                        key={code}
                        whileHover={{ 
                          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,122,255,0.08)'
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleLanguageSelect(code)}
                        className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-all ${
                          currentLanguage === code 
                            ? theme === 'dark' 
                              ? 'bg-blue-500 text-white shadow-sm' 
                              : 'bg-blue-500 text-white shadow-sm'
                            : ''
                        }`}
                      >
                        <span className="text-lg mr-3">{getLanguageFlag(code)}</span>
                        <div className="flex-1">
                          <div className={`font-medium text-sm ${
                            currentLanguage === code ? 'text-white' : 'text-ios-gray-900 dark:text-white'
                          }`}>
                            {language.nativeName}
                          </div>
                          <div className={`text-xs ${
                            currentLanguage === code ? 'text-blue-100' : 'text-ios-gray-500 dark:text-ios-gray-400'
                          }`}>
                            {language.name}
                          </div>
                        </div>
                        {currentLanguage === code && (
                          <svg className="w-4 h-4 ml-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </motion.button>
                    ))
                  )}
                </div>
              </div>

              {/* Close Button */}
              <div className="p-3 border-t border-ios-gray-200 dark:border-ios-gray-600">
                <motion.button
                  whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setIsFullListOpen(false);
                    setSearchQuery('');
                  }}
                  className="w-full py-2.5 text-sm font-medium text-ios-gray-600 dark:text-ios-gray-300 rounded-xl bg-ios-gray-100 dark:bg-ios-gray-800 transition-colors"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;
