import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '../../hooks/useGeolocation';
import LoadingSpinner from '../../components/IEBCOffice/LoadingSpinner';
import AppFooter from '@/components/UI/AppFooter';
import { useTheme } from '@/contexts/ThemeContext';

// Enhanced Background Layers with Faded Image and Proper Dark Mode
const BackgroundLayers = ({ className = "" }) => {
  const { theme } = useTheme();
  
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
    >
      {/* Faded Background Image - MAINTAINED FROM ORIGINAL */}
      <div className="absolute inset-0 will-change-transform">
        <div className="bg-peek absolute inset-0" />
      </div>

      {/* Dark Mode Overlay - Enhanced for better contrast */}
      <div className="absolute inset-0 will-change-transform">
        <div className={`absolute inset-0 transition-all duration-500 ${
          theme === 'dark' 
            ? 'bg-ios-gray-900/80' 
            : 'bg-white/0'
        }`} />
      </div>

      {/* Pattern Overlay - Enhanced for dark mode */}
      <div className="absolute inset-0">
        <div className={`absolute inset-0 transition-all duration-500 ${
          theme === 'dark'
            ? 'bg-pattern-grid-dark opacity-15'
            : 'bg-pattern opacity-50'
        }`} />
      </div>

      {/* Enhanced Vignette - Dynamic for theme */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute inset-0 transition-all duration-500 ${
          theme === 'dark'
            ? 'bg-vignette-dark'
            : 'bg-vignette'
        }`} />
      </div>

      {/* Subtle Color Overlay for Better Text Readability */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute inset-0 transition-all duration-500 ${
          theme === 'dark'
            ? 'bg-gradient-to-b from-ios-gray-900/70 via-ios-gray-900/40 to-ios-gray-900/70'
            : 'bg-gradient-to-b from-white/60 via-white/30 to-white/60'
        }`} />
      </div>
    </div>
  );
};

// Theme Toggle Component
const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="absolute top-6 right-6 z-20 w-10 h-10 rounded-full bg-white dark:bg-ios-gray-800 shadow-lg dark:shadow-ios-gray-900/50 border border-ios-gray-200 dark:border-ios-gray-600 flex items-center justify-center transition-all duration-300"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <motion.div
        initial={false}
        animate={{ rotate: theme === 'dark' ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {theme === 'dark' ? (
          <svg className="w-5 h-5 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
          </svg>
        ) : (
          <svg className="w-5 h-5 text-ios-gray-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/>
          </svg>
        )}
      </motion.div>
    </motion.button>
  );
};

const IEBCOfficeSplash = () => {
  const navigate = useNavigate();
  const { location, error, loading, requestLocation } = useGeolocation();
  const [showError, setShowError] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    if (location) {
      const timer = setTimeout(() => {
        navigate('/iebc-office/map', { 
          state: { userLocation: location },
          replace: true 
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [location, navigate]);

  useEffect(() => {
    if (error) {
      setShowError(true);
    }
  }, [error]);

  const handleAllowLocation = () => {
    setShowError(false);
    requestLocation();
  };

  const handleManualEntry = () => {
    navigate('/iebc-office/map', { 
      state: { manualEntry: true },
      replace: true 
    });
  };

  const splashVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        duration: 0.5,
        ease: [0.4, 0.0, 0.2, 1]
      }
    },
    exit: { 
      opacity: 0,
      y: -20,
      transition: { duration: 0.3 }
    }
  };

  const iconVariants = {
    initial: { scale: 1 },
    animate: { 
      scale: [1, 1.1, 1],
      transition: { 
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const headlineVariants = {
    initial: { 
      opacity: 0, 
      y: -50,
      scale: 0.8
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 15,
        delay: 0.1
      }
    }
  };

  const subheadlineVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        delay: 0.3,
        duration: 0.5
      }
    }
  };

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-500 ${
      theme === 'dark' 
        ? 'bg-ios-gray-900 text-white' 
        : 'bg-white text-ios-gray-900'
    }`}>
      <ThemeToggle />
      
      <motion.div
        className="relative flex flex-col items-center justify-center flex-1 px-6 overflow-hidden"
        variants={splashVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <BackgroundLayers />
        
        <div className="relative z-10 text-center max-w-md w-full mb-8">
          <motion.div
            className="relative flex items-center justify-center w-32 h-32 mx-auto mb-2"
            variants={iconVariants}
            initial="initial"
            animate="animate"
          >
            <div className={`absolute inset-0 rounded-full animate-ping ${
              theme === 'dark' 
                ? 'bg-ios-blue/30' 
                : 'bg-ios-blue/20'
            }`} />
            <div className={`absolute inset-4 rounded-full flex items-center justify-center shadow-lg ${
              theme === 'dark'
                ? 'bg-ios-blue-600 shadow-ios-blue/25'
                : 'bg-ios-blue shadow-ios-blue/25'
            }`}>
              <svg 
                className="w-16 h-16 text-white mx-auto my-auto block" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
                />
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
                />
              </svg>
            </div>
          </motion.div>
          
          <motion.div
            className="mb-4"
            variants={headlineVariants}
            initial="initial"
            animate="animate"
          >
            <h1 className={`text-6xl font-black mb-2 tracking-tight leading-none ${
              theme === 'dark' ? 'text-white' : 'text-ios-gray-900'
            }`}>
              NASAKA
            </h1>
            <div className="flex items-center justify-center space-x-2">
              <div className={`h-px w-8 ${
                theme === 'dark' ? 'bg-ios-blue/60' : 'bg-ios-blue/40'
              }`}></div>
              <h2 className={`text-xl font-semibold tracking-wide ${
                theme === 'dark' ? 'text-ios-blue-400' : 'text-ios-blue'
              }`}>
                IEBC
              </h2>
              <div className={`h-px w-8 ${
                theme === 'dark' ? 'bg-ios-blue/60' : 'bg-ios-blue/40'
              }`}></div>
            </div>
          </motion.div>

          <motion.h2
            className={`text-2xl font-semibold mb-3 ${
              theme === 'dark' ? 'text-white' : 'text-ios-gray-900'
            }`}
            variants={subheadlineVariants}
            initial="initial"
            animate="animate"
          >
            Find Your Nearest IEBC Office
          </motion.h2>

          <motion.p
            className={`mb-8 text-base ${
              theme === 'dark' ? 'text-ios-gray-300' : 'text-ios-gray-600'
            }`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Allow location access to find the closest IEBC registration center and get turn-by-turn navigation.
          </motion.p>

          <AnimatePresence>
            {showError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <div className={`rounded-xl p-4 border ${
                  theme === 'dark'
                    ? 'bg-ios-red/20 border-ios-red/30 text-ios-red-300'
                    : 'bg-ios-red/10 border-ios-red/20 text-ios-red'
                }`}>
                  <p className="text-sm font-medium">
                    {error === 'Permission denied' 
                      ? 'Location access denied. Please enable location services in your browser settings.'
                      : 'Unable to access your location. You can still search for offices manually.'
                    }
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="flex flex-col space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAllowLocation}
              disabled={loading}
              className={`px-8 py-4 rounded-2xl font-semibold text-base disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg transition-all duration-300 ${
                theme === 'dark'
                  ? 'bg-ios-blue-600 text-white shadow-ios-blue/40 hover:bg-ios-blue-700'
                  : 'bg-ios-blue text-white shadow-ios-blue/25 hover:bg-ios-blue-500'
              }`}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" />
                  <span>Detecting Location...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Allow Location Access</span>
                </>
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleManualEntry}
              className={`px-8 py-4 rounded-2xl font-medium text-base border transition-all duration-300 ${
                theme === 'dark'
                  ? 'text-ios-blue-400 border-ios-gray-600 bg-ios-gray-800 hover:bg-ios-gray-700 hover:border-ios-gray-500'
                  : 'text-ios-blue border-ios-gray-300 bg-white hover:bg-ios-gray-50 hover:border-ios-gray-400'
              }`}
            >
              Search Manually
            </motion.button>
          </motion.div>

          <motion.p
            className={`text-xs mt-8 ${
              theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-500'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Your location data is processed locally and never stored on our servers.
          </motion.p>
        </div>
      </motion.div>

      {/* Footer */}
      <AppFooter />
    </div>
  );
};

export default IEBCOfficeSplash;