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
  const { t } = useTranslation('nasaka');
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const [isMobile, setIsMobile] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const [interactionState, setInteractionState] = useState<
    'idle' | 'quick' | 'full'
  >('idle');
  const [priorityLanguages, setPriorityLanguages] = useState<LanguageCode[]>([]);
  
  const longPressTimer = useRef<NodeJS.Timeout>();

  // Platform detection
  useEffect(() => {
    const checkMobile = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isTouch || isSmallScreen);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Smart language prioritization
  useEffect(() => {
    const getGeoRelevantLanguages = (): LanguageCode[] => {
      // In a real app, this would use geolocation or IP-based detection
      // For now, we'll return languages commonly used in the region
      return ['sw', 'luo', 'kik']; // Common in East Africa
    };

    const getPriorityLanguages = () => {
      const allLangs = Object.keys(availableLanguages) as LanguageCode[];
      
      const priorities = [
        currentLanguage,
        navigator.language.split('-')[0] as LanguageCode,
        ...getGeoRelevantLanguages(),
      ].filter(Boolean);
      
      const unique = [...new Set(priorities)].filter(lang => allLangs.includes(lang));
      const remaining = allLangs.filter(lang => !unique.includes(lang)).sort();
      
      return [...unique, ...remaining].slice(0, 5);
    };
    
    setPriorityLanguages(getPriorityLanguages());
  }, [currentLanguage, availableLanguages]);

  // Determine variant based on current route
  const effectiveVariant = variant === 'splash' 
    ? location.pathname === '/iebc-office' || location.pathname === '/nasaka-iebc'
    : variant === 'map';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        closeModal();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const closeModal = () => {
    setDropdownOpen(false);
    setInteractionState('idle');
    setIsLongPressing(false);
    setPressProgress(0);
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  // Mobile-specific long press with progress indicator
  const handleMobilePressStart = () => {
    if (!isMobile) return;
    
    setIsLongPressing(true);
    setPressProgress(0);
    
    longPressTimer.current = setInterval(() => {
      setPressProgress(prev => {
        const newProgress = prev + 3.33; // Complete in 300ms
        if (newProgress >= 100) {
          clearInterval(longPressTimer.current);
          handleFullAccess();
          setIsLongPressing(false);
          setPressProgress(0);
          return 100;
        }
        return newProgress;
      });
    }, 10);
  };

  // Desktop interaction - no progress indicator
  const handleDesktopInteraction = (e: React.MouseEvent) => {
    if (isMobile) return;
    
    if (e.shiftKey) { // Shift+click for full access
      handleFullAccess();
    } else {
      handleQuickAccess();
    }
  };

  const handleQuickAccess = () => {
    setInteractionState('quick');
    setDropdownOpen(true);
  };

  const handleFullAccess = () => {
    if (isMobile && 'vibrate' in navigator) {
      navigator.vibrate(50); // Haptic feedback on mobile
    }
    setInteractionState('full');
    setDropdownOpen(true);
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearInterval(longPressTimer.current);
      longPressTimer.current = undefined;
    }
    
    if (isMobile && isLongPressing && pressProgress < 80) {
      // Short press on mobile - quick access
      handleQuickAccess();
    }
    
    setIsLongPressing(false);
    setPressProgress(0);
  };

  const handleLanguageSelect = async (languageCode: string) => {
    console.log('Language selected:', languageCode);
    const success = await changeLanguage(languageCode as LanguageCode);
    if (success) {
      console.log('Language selection successful');
      closeModal();
    } else {
      console.error('Language selection failed');
    }
  };

  const getLanguageFlag = (code: string) => {
    const flags: Record<string, string> = {
      en: '🇬🇧',
      sw: '🇰🇪', 
      kik: '🇰🇪',
      luo: '🇰🇪',
    };
    return flags[code] || '🌐';
  };

  // Button styles
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

  // Modal styles
  const modalClass = effectiveVariant
    ? `absolute top-12 right-0 rounded-2xl shadow-xl border backdrop-blur-lg z-50 ${
        theme === 'dark'
          ? 'bg-ios-gray-800/95 border-ios-gray-600 text-white'
          : 'bg-white/95 border-ios-gray-200 text-ios-gray-900'
      }`
    : `absolute top-12 right-0 rounded-lg shadow-xl border backdrop-blur-lg z-50 ${
        theme === 'dark'
          ? 'bg-ios-gray-800/95 border-ios-gray-600 text-white'
          : 'bg-white/95 border-ios-gray-200 text-ios-gray-900'
      }`;

  const quickModalWidth = 'min-w-48';
  const fullModalWidth = 'min-w-64 max-w-80 max-h-96 overflow-y-auto';

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

  const renderQuickAccessModal = () => (
    <div className="p-2">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider opacity-60">
        Quick Languages
      </div>
      
      {priorityLanguages.map((code) => (
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
            <div className="font-medium">{availableLanguages[code]?.nativeName}</div>
            <div className="text-sm opacity-70">{availableLanguages[code]?.name}</div>
          </div>
          {currentLanguage === code && (
            <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </motion.button>
      ))}

      <div className="px-3 py-2 mt-2 text-xs opacity-50 border-t border-current border-opacity-20">
        {isMobile ? (
          <p>📱 Hold for all {Object.keys(availableLanguages).length} languages</p>
        ) : (
          <p>🖱️ Shift+click for all {Object.keys(availableLanguages).length} languages</p>
        )}
      </div>
    </div>
  );

  const renderFullAccessModal = () => (
    <div className="p-2">
      <div className="px-3 py-2 flex justify-between items-center border-b border-current border-opacity-20">
        <div className="text-xs font-semibold uppercase tracking-wider opacity-60">
          All Languages ({Object.keys(availableLanguages).length})
        </div>
        <button
          onClick={closeModal}
          className="text-xs opacity-50 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
      
      <div className="max-h-80 overflow-y-auto">
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
      </div>

      <div className="px-3 py-2 mt-2 text-xs opacity-50 border-t border-current border-opacity-20">
        <p>✨ {Object.keys(availableLanguages).length} languages available</p>
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {/* Mobile-only circular progress indicator */}
      <AnimatePresence>
        {isMobile && isLongPressing && (
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
        onMouseDown={isMobile ? handleMobilePressStart : undefined}
        onMouseUp={isMobile ? handlePressEnd : undefined}
        onMouseLeave={isMobile ? handlePressEnd : undefined}
        onTouchStart={isMobile ? handleMobilePressStart : undefined}
        onTouchEnd={isMobile ? handlePressEnd : undefined}
        onClick={isMobile ? undefined : handleDesktopInteraction}
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
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
              d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" 
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
              d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" 
            />
          </svg>
        </motion.div>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isDropdownOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={closeModal}
            />
            
            {/* Modal content */}
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`${modalClass} ${
                interactionState === 'quick' ? quickModalWidth : fullModalWidth
              }`}
            >
              {interactionState === 'quick' ? renderQuickAccessModal() : renderFullAccessModal()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSwitcher;
