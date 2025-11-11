import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

interface LanguageSwitcherProps {
  variant?: 'splash' | 'map';
  className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  variant = 'splash', 
  className = '' 
}) => {
  const {
    currentLanguage,
    availableLanguages,
    changeLanguage,
    isLoading,
    isDropdownOpen,
    setDropdownOpen
  } = useLanguage();
  
  const { theme } = useTheme();
  const { t, i18n } = useTranslation('nasaka');
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout>();
  const [pressProgress, setPressProgress] = useState(0);

  // Determine variant based on current route if not explicitly set
  const effectiveVariant = variant === 'splash' 
    ? location.pathname === '/iebc-office' || location.pathname === '/nasaka-iebc'
    : variant === 'map';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, setDropdownOpen]);

  // Long press handlers
  const handleMouseDown = () => {
    setIsLongPressing(true);
    setPressProgress(0);
    
    longPressTimer.current = setInterval(() => {
      setPressProgress(prev => {
        const newProgress = prev + 3.33; // Complete in 300ms
        if (newProgress >= 100) {
          clearInterval(longPressTimer.current);
          setDropdownOpen(true);
          setIsLongPressing(false);
          setPressProgress(0);
          return 100;
        }
        return newProgress;
      });
    }, 10);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearInterval(longPressTimer.current);
      longPressTimer.current = undefined;
    }
    setIsLongPressing(false);
    setPressProgress(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearInterval(longPressTimer.current);
      }
    };
  }, []);

  // FIXED: Language selection handler
  const handleLanguageSelect = async (languageCode: string) => {
    console.log('Selecting language:', languageCode);
    const success = await changeLanguage(languageCode as any);
    if (success) {
      console.log('Language selection successful');
    } else {
      console.error('Language selection failed');
    }
  };

  const getLanguageFlag = (code: string) => {
    const flags: Record<string, string> = {
      en: '🇺🇸',
      sw: '🇹🇿', 
      kik: '🇰🇪',
    };
    return flags[code] || '🌐';
  };

  // Button styles based on variant
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

  // Dropdown styles based on variant
  const dropdownClass = effectiveVariant
    ? `absolute top-12 right-0 min-w-48 rounded-2xl shadow-xl border backdrop-blur-lg z-50 ${
        theme === 'dark'
          ? 'bg-ios-gray-800/95 border-ios-gray-600 text-white'
          : 'bg-white/95 border-ios-gray-200 text-ios-gray-900'
      }`
    : `absolute top-12 right-0 min-w-48 rounded-lg shadow-xl border backdrop-blur-lg z-50 ${
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
        rotate: { duration: 0.6, ease: "easeInOut" },
        scale: { duration: 0.6, ease: "easeInOut" }
      }
    },
    hover: {
      scale: 1.1,
      rotate: [0, -5, 5, 0],
      transition: {
        duration: 0.4,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Long press progress indicator */}
      <AnimatePresence>
        {isLongPressing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -inset-4 rounded-full pointer-events-none z-10"
            style={{
              background: `conic-gradient(#007AFF ${pressProgress}%, transparent ${pressProgress}%)`
            }}
          />
        )}
      </AnimatePresence>

      {/* Main language button */}
      <motion.button
        ref={buttonRef}
        whileHover="hover"
        whileTap={{ scale: 0.95 }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onClick={() => !isLongPressing && setDropdownOpen(!isDropdownOpen)}
        className={buttonClass}
        disabled={isLoading}
        aria-label={t('common.changeLanguage') || "Change language"}
      >
        <motion.div
          variants={globeVariants}
          initial="initial"
          animate={isLoading ? "rotating" : "initial"}
          className="relative"
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          
          {/* Current language indicator */}
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
        </motion.div>
      </motion.button>

      {/* Language dropdown */}
      <AnimatePresence>
        {isDropdownOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
            />
            
            {/* Dropdown menu */}
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={dropdownClass}
            >
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider opacity-60">
                  {t('common.language') || "Language"}
                </div>
                
                {Object.entries(availableLanguages).map(([code, language]) => (
                  <motion.button
                    key={code}
                    whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleLanguageSelect(code)}
                    className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors ${
                      currentLanguage === code 
                        ? theme === 'dark' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-blue-100 text-blue-700'
                        : ''
                    }`}
                  >
                    <span className="text-lg mr-3">{getLanguageFlag(code)}</span>
                    <div className="flex-1">
                      <div className="font-medium">{language.nativeName}</div>
                      <div className="text-sm opacity-70">{language.name}</div>
                    </div>
                    {currentLanguage === code && (
                      <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </motion.button>
                ))}

                {/* Add language hint */}
                <div className="px-3 py-2 mt-2 text-xs opacity-50 border-t border-current border-opacity-20">
                  {t('common.longPressHint') || "Long press for quick access"}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;
