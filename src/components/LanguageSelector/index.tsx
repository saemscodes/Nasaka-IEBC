import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { 
  getAvailableLanguages, 
  getLanguagePersonality,
  getCurrentLanguage,
  type LanguageConfig 
} from '@/i18n/languageRegistry';
import FloatingLanguageButton from './FloatingLanguageButton';
import './languageSelector.css';

interface PhysicsState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
}

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const progressTimerRef = useRef<NodeJS.Timeout>();
  const physicsStatesRef = useRef<Map<string, PhysicsState>>(new Map());

  const languages = getAvailableLanguages();
  const maxVisibleButtons = 3;
  const visibleLanguages = languages.slice(0, maxVisibleButtons);
  const hasOverflow = languages.length > maxVisibleButtons;

  // Long press handling
  const startLongPress = () => {
    setLongPressProgress(0);
    let progress = 0;
    
    progressTimerRef.current = setInterval(() => {
      progress += 100 / (600 / 16); // 600ms total
      setLongPressProgress(Math.min(progress, 100));
      
      if (progress >= 100) {
        clearInterval(progressTimerRef.current);
        setIsExpanded(true);
        setLongPressProgress(0);
      }
    }, 16);
  };

  const cancelLongPress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    setLongPressProgress(0);
  };

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setIsExpanded(false);
    setIsHovering(false);
  };

  const handleMainButtonClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  };

  const handleMainButtonHover = () => {
    setIsHovering(true);
  };

  const handleMainButtonHoverEnd = () => {
    setIsHovering(false);
  };

  // Cleanup timers
  useEffect(() => {
    return () => {
      cancelLongPress();
    };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setIsHovering(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  const getButtonPositions = () => {
    if (!mainButtonRef.current) return [];

    const radius = 60; // Reduced from 80 to 60px for closer positioning
    const positions = visibleLanguages.map((_, index) => {
      const angle = (index * (2 * Math.PI)) / visibleLanguages.length - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      return { x, y };
    });

    // Position for overflow button (if needed)
    if (hasOverflow) {
      const overflowAngle = (visibleLanguages.length * (2 * Math.PI)) / (visibleLanguages.length + 1) - Math.PI / 2;
      const overflowX = Math.cos(overflowAngle) * radius;
      const overflowY = Math.sin(overflowAngle) * radius;
      positions.push({ x: overflowX, y: overflowY });
    }

    return positions;
  };

  const currentLanguage = getCurrentLanguage();

  return (
    <div className="language-selector-container" ref={containerRef}>
      {/* Main Language Selector Button */}
      <motion.button
        ref={mainButtonRef}
        className={`language-selector-main ${theme} ${isExpanded ? 'expanded' : ''}`}
        onClick={handleMainButtonClick}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onMouseEnter={handleMainButtonHover}
        onMouseLeave={handleMainButtonHoverEnd}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Change language"
      >
        {/* Long press progress indicator */}
        <motion.div
          className="long-press-progress"
          style={{
            scale: longPressProgress / 100,
            opacity: longPressProgress > 0 ? 1 : 0
          }}
        />
        
        {/* Globe icon */}
        <motion.svg
          className="globe-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          animate={{ 
            rotate: isExpanded ? 180 : 0,
            scale: isExpanded ? 1.2 : 1
          }}
          transition={{ duration: 0.3 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          
          {/* Language indicator dots */}
          <motion.circle
            cx="8"
            cy="19"
            r="1.5"
            fill={getLanguagePersonality(currentLanguage.code).color}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.svg>
      </motion.button>

      {/* Floating Language Buttons */}
      <AnimatePresence>
        {isExpanded && (
          <div className="floating-buttons-container">
            {visibleLanguages.map((language, index) => {
              const positions = getButtonPositions();
              const position = positions[index] || { x: 0, y: 0 };
              
              return (
                <FloatingLanguageButton
                  key={language.code}
                  language={language}
                  position={position}
                  index={index}
                  isHoveringMain={isHovering}
                  onSelect={handleLanguageChange}
                  isSelected={i18n.language === language.code}
                  physicsStatesRef={physicsStatesRef}
                />
              );
            })}

            {/* Overflow indicator (if more than maxVisibleButtons) */}
            {hasOverflow && (
              <motion.button
                className={`language-overflow-button ${theme}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: getButtonPositions()[visibleLanguages.length]?.x || 0,
                  y: getButtonPositions()[visibleLanguages.length]?.y || 0
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: visibleLanguages.length * 0.1
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  // Simple alert for now - can be replaced with modal
                  const remainingLanguages = languages.slice(maxVisibleButtons);
                  alert(`Additional languages: ${remainingLanguages.map(l => l.nativeName).join(', ')}`);
                }}
              >
                <span className="overflow-dots">•••</span>
              </motion.button>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSelector;
