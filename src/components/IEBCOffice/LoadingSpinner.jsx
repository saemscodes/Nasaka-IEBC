import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const DEFAULT_PHRASES = [
  "Getting you on the map shortly…",
  "Won't be long now…",
  "Preparing your civic toolkit…",
  "Scanning 30,000+ registration centres…",
  "Kenya has 290 constituencies — we know them all…",
  "Mapping every ward, every office…",
  "Finding the nearest IEBC office to you…",
  "Connecting to live data…",
  "Crunching the latest boundary data…",
  "Almost there — hang tight…",
  "Your vote matters — let's find where to register…",
  "Loading real-time office status…",
  "Optimizing route intelligence…",
  "Cross-referencing Kenya Gazette data…",
  "Pulling in diaspora registration centres worldwide…",
  "Verifying office coordinates with satellite imagery…",
  "One moment — democracy is loading…",
];

const LoadingSpinner = ({ size = 'medium', className = '', showPhrases = false }) => {
  const { t } = useTranslation();
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  const spinnerVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }
    }
  };

  const [phraseIndex, setPhraseIndex] = useState(0);
  
  // Use localized phrases if available, otherwise fallback to defaults
  const phrases = t('common.loadingPhrases', { returnObjects: true }) || DEFAULT_PHRASES;
  const currentPhrases = Array.isArray(phrases) ? phrases : DEFAULT_PHRASES;

  useEffect(() => {
    if (!showPhrases) return;
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % currentPhrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [showPhrases, currentPhrases.length]);

  if (!showPhrases) {
    return (
      <motion.div
        className={`${sizeClasses[size]} border-2 border-ios-gray-300 border-t-ios-blue rounded-full ${className}`}
        variants={spinnerVariants}
        animate="animate"
      />
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      {/* Spinner */}
      <motion.div
        className={`${sizeClasses[size]} border-2 border-ios-gray-300 border-t-ios-blue rounded-full`}
        variants={spinnerVariants}
        animate="animate"
      />

      {/* Rotating phrases */}
      <div className="min-h-[3.5rem] relative overflow-hidden w-full max-w-sm text-center px-4">
        <AnimatePresence mode="wait">
          <motion.p
            key={phraseIndex}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              opacity: { duration: 0.2 }
            }}
            className="text-sm font-medium text-ios-gray-500 absolute inset-0 flex items-center justify-center leading-snug px-2"
          >
            {currentPhrases[phraseIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LoadingSpinner;
