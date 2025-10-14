import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '../../hooks/useGeolocation';
import LoadingSpinner from '../../components/IEBCOffice/LoadingSpinner';
import AppFooter from '@/components/UI/AppFooter';
import { useTheme } from '@/contexts/ThemeContext';
import { useTheme } from '@/contexts/ThemeContext';

const BackgroundLayers = ({ className = "" }) => {
  const { theme } = useTheme();

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
    >
      {/* Main Background Layer */}
      <div className="absolute inset-0 will-change-transform">
        <div className={`absolute inset-0 transition-colors duration-300 ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-ios-gray-900 via-ios-gray-800 to-ios-gray-950' 
            : 'bg-gradient-to-br from-ios-blue-50 via-white to-ios-gray-100'
        }`} />
      </div>

      {/* Animated Gradient Overlay */}
      <div className="absolute inset-0 opacity-60">
        <div className={`absolute inset-0 transition-all duration-500 ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-ios-blue-900/20 via-ios-purple-900/10 to-ios-gray-800/30'
            : 'bg-gradient-to-br from-ios-blue-100/40 via-ios-green-50/30 to-ios-orange-100/20'
        }`} />
      </div>

      {/* Dynamic Pattern Overlay */}
      <div className="absolute inset-0">
        <div className={`absolute inset-0 transition-opacity duration-300 ${
          theme === 'dark' 
            ? 'bg-pattern-grid-dark opacity-10' 
            : 'bg-pattern-grid opacity-5'
        }`} />
      </div>

      {/* Animated Floating Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Circles */}
        <motion.div
          className={`absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl ${
            theme === 'dark'
              ? 'bg-ios-blue-600/10'
              : 'bg-ios-blue-300/30'
          }`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className={`absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full blur-3xl ${
            theme === 'dark'
              ? 'bg-ios-purple-600/10'
              : 'bg-ios-purple-300/20'
          }`}
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.2, 0.4],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
        <motion.div
          className={`absolute top-1/2 right-1/3 w-32 h-32 rounded-full blur-2xl ${
            theme === 'dark'
              ? 'bg-ios-green-500/10'
              : 'bg-ios-green-300/20'
          }`}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
      </div>

      {/* Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute inset-0 transition-all duration-300 ${
          theme === 'dark'
            ? 'bg-vignette-dark'
            : 'bg-vignette-light'
        }`} />
      </div>

      {/* Animated Grid Lines */}
      <div className="absolute inset-0 opacity-30">
        <div className={`absolute inset-0 bg-grid-white/[0.02] bg-[length:50px_50px] ${
          theme === 'dark' ? 'opacity-20' : 'opacity-10'
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
      className="absolute top-6 right-6 z-50 w-12 h-12 rounded-2xl bg-white/80 dark:bg-ios-gray-800/80 shadow-lg dark:shadow-ios-gray-900/50 border border-ios-gray-200/50 dark:border-ios-gray-600/50 backdrop-blur-xl flex items-center justify-center transition-all duration-300 hover:shadow-xl"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <motion.div
        key={theme}
        initial={{ scale: 0.8, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.3, type: "spring" }}
        className="relative"
      >
        {theme === 'dark' ? (
          <svg className="w-6 h-6 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
          </svg>
        ) : (
          <svg className="w-6 h-6 text-ios-orange-500" fill="currentColor" viewBox="0 0 24 24">
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
    initial: { scale: 1, rotate: 0 },
    animate: { 
      scale: [1, 1.05, 1],
      rotate: [0, -5, 5, 0],
      transition: { 
        duration: 3,
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

  const buttonVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        delay: 0.5,
        duration: 0.4
      }
    },
    hover: {
      scale: 1.02,
      transition: { duration: 0.2 }
    },
    tap: {
      scale: 0.98
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
          {/* Animated Logo Container */}
          <motion.div
            className="relative flex items-center justify-center w-40 h-40 mx-auto mb-4"
            variants={iconVariants}
            initial="initial"
            animate="animate"
          >
            {/* Outer Glow */}
            <motion.div
              className={`absolute inset-0 rounded-full ${
                theme === 'dark' 
                  ? 'bg-ios-blue-400/20' 
                  : 'bg-ios-blue-200/40'
              }`}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Pulsing Ring */}
            <motion.div
              className={`absolute inset-0 rounded-full border-2 ${
                theme === 'dark' 
                  ? 'border-ios-blue-400/30' 
                  : 'border-ios-blue-300/50'
              }`}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [1, 0, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Main Icon Container */}
            <div className={`absolute inset-6 rounded-3xl ${
              theme === 'dark' 
                ? 'bg-gradient-to-br from-ios-blue-600 to-ios-blue-700 shadow-2xl shadow-ios-blue-500/30' 
                : 'bg-gradient-to-br from-ios-blue-500 to-ios-blue-600 shadow-2xl shadow-ios-blue-500/40'
            } flex items-center justify-center backdrop-blur-sm`}>
              <svg 
                className="w-20 h-20 text-white mx-auto my-auto block" 
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
          
          {/* Main Headline */}
          <motion.div
            className="mb-6"
            variants={headlineVariants}
            initial="initial"
            animate="animate"
          >
            <motion.h1 
              className={`text-7xl font-black mb-3 tracking-tight leading-none ${
                theme === 'dark' 
                  ? 'text-white drop-shadow-lg' 
                  : 'text-ios-gray-900'
              }`}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              NASAKA
            </motion.h1>
            
            <motion.div 
              className="flex items-center justify-center space-x-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className={`h-px w-12 ${
                theme === 'dark' 
                  ? 'bg-ios-blue-400/60' 
                  : 'bg-ios-blue-500/40'
              }`}></div>
              <motion.h2 
                className={`text-xl font-semibold tracking-wide ${
                  theme === 'dark' 
                    ? 'text-ios-blue-300' 
                    : 'text-ios-blue-600'
                }`}
                whileHover={{ scale: 1.05 }}
              >
                IEBC OFFICE FINDER
              </motion.h2>
              <div className={`h-px w-12 ${
                theme === 'dark' 
                  ? 'bg-ios-blue-400/60' 
                  : 'bg-ios-blue-500/40'
              }`}></div>
            </motion.div>
          </motion.div>

          {/* Subheadline */}
          <motion.h3
            className={`text-2xl font-semibold mb-4 ${
              theme === 'dark' 
                ? 'text-ios-gray-100' 
                : 'text-ios-gray-800'
            }`}
            variants={subheadlineVariants}
            initial="initial"
            animate="animate"
          >
            Find Your Nearest IEBC Office
          </motion.h3>

          {/* Description */}
          <motion.p
            className={`mb-8 text-lg leading-relaxed ${
              theme === 'dark' 
                ? 'text-ios-gray-300' 
                : 'text-ios-gray-600'
            }`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Allow location access to find the closest IEBC registration center 
            and get turn-by-turn navigation for voter registration.
          </motion.p>

          {/* Error Message */}
          <AnimatePresence>
            {showError && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.9 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.9 }}
                className="mb-6"
              >
                <div className={`rounded-2xl p-4 border ${
                  theme === 'dark'
                    ? 'bg-ios-red-900/20 border-ios-red-700/30 text-ios-red-200'
                    : 'bg-ios-red-50 border-ios-red-200 text-ios-red-700'
                } backdrop-blur-sm`}>
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

          {/* Action Buttons */}
          <motion.div
            className="flex flex-col space-y-4"
            variants={buttonVariants}
            initial="initial"
            animate="animate"
          >
            {/* Allow Location Button */}
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleAllowLocation}
              disabled={loading}
              className={`w-full py-5 rounded-2xl font-semibold text-lg disabled:opacity-50 flex items-center justify-center space-x-3 transition-all duration-300 ${
                theme === 'dark'
                  ? 'bg-ios-blue-500 hover:bg-ios-blue-400 active:bg-ios-blue-600 text-white shadow-lg shadow-ios-blue-500/25'
                  : 'bg-ios-blue-500 hover:bg-ios-blue-400 active:bg-ios-blue-600 text-white shadow-lg shadow-ios-blue-500/40'
              }`}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" />
                  <span>Detecting Location...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Allow Location Access</span>
                </>
              )}
            </motion.button>

            {/* Manual Search Button */}
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleManualEntry}
              className={`w-full py-5 rounded-2xl font-medium text-lg border transition-all duration-300 ${
                theme === 'dark'
                  ? 'border-ios-gray-600 bg-ios-gray-800/50 hover:bg-ios-gray-700/50 text-ios-blue-300 hover:text-ios-blue-200 backdrop-blur-sm'
                  : 'border-ios-gray-300 bg-white hover:bg-ios-gray-50 text-ios-blue-500 hover:text-ios-blue-600'
              }`}
            >
              Search Manually
            </motion.button>
          </motion.div>

          {/* Privacy Notice */}
          <motion.p
            className={`mt-8 text-sm ${
              theme === 'dark' 
                ? 'text-ios-gray-400' 
                : 'text-ios-gray-500'
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