import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '../../hooks/useGeolocation';
import LoadingSpinner from '../../components/IEBCOffice/LoadingSpinner';
import DonationWidget from '@/components/ui/DonationWidget';
import { useTheme } from '@/contexts/ThemeContext';

// Enhanced Background Layers with Cursor-Tracking Radial Effects
const BackgroundLayers = ({ className = "" }) => {
  const { theme } = useTheme();
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      setCursorPos({ x, y });
      setIsHovering(true);
    };

    const handleMouseLeave = () => {
      setIsHovering(false);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
    >
      {/* Faded Background Image */}
      <div className="absolute inset-0 will-change-transform">
        <div
          className={`bg-peek absolute inset-0 transition-all duration-500 ${
            theme === 'dark' ? 'opacity-50' : 'opacity-100'
          }`}
        />
      </div>
      
      {/* Dark Mode Base Overlay */}
      <div className="absolute inset-0 will-change-transform">
        <div className={`absolute inset-0 transition-all duration-500 ${
          theme === 'dark' 
            ? 'bg-ios-gray-900/80' 
            : 'bg-white/0'
        }`} />
      </div>

      {/* Dynamic Pattern Overlay with Color Drift */}
      <div className="absolute inset-0">
        <motion.div
          className={`absolute inset-0 transition-all duration-1000 ${
            theme === 'dark'
              ? 'bg-iebc-pattern-dark'
              : 'bg-iebc-pattern'
          }`}
          animate={{
            filter: theme === 'dark' ? [
              'hue-rotate(0deg)',
              'hue-rotate(15deg)',
              'hue-rotate(-10deg)',
              'hue-rotate(0deg)'
            ] : 'none'
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      {/* Cursor-Tracking Radial Gradient - Dark Mode Only */}
      {theme === 'dark' && (
        <>
          {/* Base Radial Glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${cursorPos.x}% ${cursorPos.y}%, 
                rgba(120, 120, 255, 0.1) 0%,
                rgba(80, 80, 200, 0.05) 20%,
                rgba(40, 40, 150, 0.02) 40%,
                transparent 70%)`
            }}
            animate={{
              opacity: isHovering ? 1 : 0.3,
              scale: isHovering ? [1, 1.02, 1] : 1
            }}
            transition={{
              opacity: { duration: 0.5 },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }}
          />
          
          {/* Dynamic Color Drift Layer */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${cursorPos.x}% ${cursorPos.y}%, 
                rgba(255, 100, 100, 0.08) 0%,
                rgba(100, 255, 100, 0.05) 25%,
                rgba(100, 100, 255, 0.08) 50%,
                transparent 70%)`,
              mixBlendMode: 'overlay'
            }}
            animate={{
              opacity: isHovering ? [0.3, 0.6, 0.3] : 0.1,
              background: isHovering ? [
                `radial-gradient(circle at ${cursorPos.x}% ${cursorPos.y}%, 
                 rgba(255, 100, 100, 0.1) 0%,
                 rgba(100, 255, 100, 0.07) 25%,
                 rgba(100, 100, 255, 0.1) 50%,
                 transparent 70%)`,
                `radial-gradient(circle at ${cursorPos.x}% ${cursorPos.y}%, 
                 rgba(100, 255, 100, 0.1) 0%,
                 rgba(100, 100, 255, 0.07) 25%,
                 rgba(255, 100, 100, 0.1) 50%,
                 transparent 70%)`,
                `radial-gradient(circle at ${cursorPos.x}% ${cursorPos.y}%, 
                 rgba(100, 100, 255, 0.1) 0%,
                 rgba(255, 100, 100, 0.07) 25%,
                 rgba(100, 255, 100, 0.1) 50%,
                 transparent 70%)`
              ] : `radial-gradient(circle at ${cursorPos.x}% ${cursorPos.y}%, 
                 rgba(255, 100, 100, 0.05) 0%,
                 rgba(100, 255, 100, 0.03) 25%,
                 rgba(100, 100, 255, 0.05) 50%,
                 transparent 70%)`
            }}
            transition={{
              opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" },
              background: { duration: 8, repeat: Infinity, ease: "easeInOut" }
            }}
          />
          
          {/* Moving Glare Sweep */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(120deg, 
                transparent 0%,
                rgba(255, 255, 255, 0.03) 45%,
                rgba(255, 255, 255, 0.08) 50%,
                rgba(255, 255, 255, 0.03) 55%,
                transparent 100%)`,
              mixBlendMode: 'soft-light',
              transformOrigin: `${cursorPos.x}% ${cursorPos.y}%`
            }}
            animate={{
              rotate: [0, 360],
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{
              rotate: { duration: 20, repeat: Infinity, ease: "linear" },
              scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 5, repeat: Infinity, ease: "easeInOut" }
            }}
          />
        </>
      )}

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

// Enhanced Theme Toggle Component with Better Visibility
const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className={`w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-ios-gray-800 shadow-ios-gray-900/50 border-ios-gray-600'
          : 'bg-white shadow-ios-gray-200/50 border-ios-gray-200'
      }`}
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

// CEKA Logo Button Component - Top Left
const CekaLogoButton = () => {
  const { theme } = useTheme();

  const handleCekaClick = () => {
    window.open('https://ceka254.vercel.app/join-community', '_blank', 'noopener,noreferrer');
  };

  const logoVariants = {
    light: { opacity: 1, scale: 1 },
    dark: { opacity: 0, scale: 0.8 }
  };

  const logoVariantsDark = {
    light: { opacity: 0, scale: 0.8 },
    dark: { opacity: 1, scale: 1 }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleCekaClick}
      className={`relative w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition-all duration-300 overflow-hidden ${
        theme === 'dark'
          ? 'bg-ios-gray-800 shadow-ios-gray-900/50 border-ios-gray-600'
          : 'bg-white shadow-ios-gray-200/50 border-ios-gray-200'
      }`}
      aria-label="Visit CEKA Community"
    >
      <motion.img 
        src="/assets/logo-coloured.png"
        alt="CEKA Logo Light"
        className="w-6 h-6 object-cover rounded-full absolute transition-transform duration-300"
        variants={logoVariants}
        initial="light"
        animate={theme === 'dark' ? "dark" : "light"}
        transition={{ duration: 0.3 }}
      />
      <motion.img 
        src="/assets/logo-white.png"
        alt="CEKA Logo Dark"
        className="w-6 h-6 object-cover rounded-full absolute transition-transform duration-300"
        variants={logoVariantsDark}
        initial="light"
        animate={theme === 'dark' ? "dark" : "light"}
        transition={{ duration: 0.3 }}
      />
    </motion.button>
  );
};

// Text Shadow Layer Component for Better Readability
const TextShadowLayer = ({ children, className = "" }) => {
  const { theme } = useTheme();

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Shadow layer hugging text */}
      <div
        className={`absolute -inset-1 rounded-lg blur-md transition-all duration-500 z-0 ${
          theme === "dark"
            ? "bg-black/40"
            : "bg-black/15"
        }`}
        aria-hidden="true"
      />
      {/* Main text content */}
      <div className="relative z-10">{children}</div>
    </div>
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
    <div className={`relative flex flex-col min-h-screen transition-colors duration-500 overflow-hidden ${
      theme === 'dark' 
        ? 'bg-ios-gray-900 text-white' 
        : 'bg-white text-ios-gray-900'
    }`}>
      {/* Top Control Bar - Full width with equal edge padding */}
      <div className="absolute top-6 left-0 right-0 z-20 flex justify-between items-center px-6">
        <CekaLogoButton />
        <ThemeToggle />
      </div>
      
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
            <div
              className={`absolute inset-4 rounded-full flex items-center justify-center shadow-lg ${
                theme === 'dark'
                ? 'bg-ios-blue-600 shadow-ios-blue/25'
                : 'bg-ios-blue shadow-ios-blue/25'
              }`}
              >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1080 1080"
                className="w-16 h-16 mx-auto my-auto block transition-all duration-500"
                fill={theme === 'dark' ? '#ffffff' : '#ffffff'}
                >
                <g
                  transform="translate(0,1080) scale(0.1,-0.1)"
                  stroke="none"
                  >
                  <path d="M5135 9223 c-559 -49 -1092 -260 -1555 -616 -117 -90 -384 -351 -477 -467 -290 -360 -500 -803 -593 -1250 -72 -351 -79 -741 -19 -1089 104 -604 429 -1261 949 -1922 103 -132 1951 -2309 1959 -2308 7 0 1719 2051 1854 2219 560 701 899 1332 1026 1905 50 227 56 288 56 580 0 294 -7 370 -52 595 -254 1267 -1318 2228 -2601 2350 -98 9 -453 11 -547 3z m575 -638 c250 -35 478 -104 692 -208 249 -122 436 -255 633 -452 356 -355 580 -799 657 -1299 31 -204 31 -519 0 -701 -86 -502 -308 -938 -653 -1284 -439 -438 -1025 -681 -1644 -681 -864 0 -1643 471 -2055 1243 -176 330 -261 685 -261 1092 0 476 126 888 394 1290 116 173 289 364 453 497 427 348 970 536 1514 523 85 -2 207 -11 270 -20z"/>
                  <path d="M5250 7760 c-597 -83 -1055 -488 -1213 -1070 -30 -112 -31 -122 -31 -330 -1 -172 3 -232 17 -300 125 -583 579 -1025 1157 -1125 126 -22 354 -22 485 0 575 96 1033 540 1161 1125 15 67 19 127 19 280 0 209 -10 279 -61 443 l-26 80 -119 -119 -120 -120 16 -88 c69 -397 -86 -810 -399 -1065 -134 -109 -267 -175 -450 -224 -69 -18 -108 -21 -266 -21 -159 0 -196 3 -265 21 -164 45 -307 116 -427 212 -214 170 -351 396 -409 673 -30 148 -23 372 16 503 36 121 74 211 125 292 206 327 541 524 920 540 296 12 569 -85 790 -283 l63 -56 106 107 106 106 -65 60 c-181 166 -432 292 -685 344 -94 19 -352 28 -445 15z"/>
                  <path d="M6780 7494 c-30 -8 -78 -29 -107 -46 -32 -20 -258 -238 -614 -594 l-563 -564 -196 195 c-170 169 -206 199 -266 227 -66 31 -75 33 -184 33 -105 0 -120 -2 -170 -27 -30 -15 -71 -41 -90 -57 l-35 -30 450 -450 c442 -443 451 -451 490 -451 39 0 49 9 867 827 l827 827 -20 22 c-31 33 -127 80 -187 93 -70 15 -135 13 -202 -5z"/>
                </g>
              </svg>
            </div>            
          </motion.div>
          
          {/* Enhanced Text Sections with Shadows */}
          <TextShadowLayer className="mb-4">
            <motion.div
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
          </TextShadowLayer>

          <TextShadowLayer className="mb-3">
            <motion.h2
              className={`text-2xl font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-ios-gray-900'
              }`}
              variants={subheadlineVariants}
              initial="initial"
              animate="animate"
            >
              Find Your Nearest IEBC Office
            </motion.h2>
          </TextShadowLayer>

          <TextShadowLayer className="mb-8">
            <motion.p
              className={`text-base ${
                theme === 'dark' ? 'text-ios-gray-300' : 'text-ios-gray-600'
              }`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Allow location access to find the closest IEBC registration center and get turn-by-turn navigation.
            </motion.p>
          </TextShadowLayer>

          <AnimatePresence>
            {showError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <TextShadowLayer>
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
                </TextShadowLayer>
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

          <TextShadowLayer className="mt-8">
            <motion.p
              className={`text-xs ${
                theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-500'
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              Your location data is processed locally and never stored on our servers.
            </motion.p>
          </TextShadowLayer>
        </div>
      </motion.div>

      {/* Donation Widget - Bottom Right */}
      <DonationWidget offsetY={100} />

      {/* Copyright Footer - Simple Bottom Center */}
      <div className="absolute bottom-4 left-0 right-0 z-10 text-center">
        <TextShadowLayer>
          <motion.p
            className={`text-xs ${
              theme === 'dark' ? 'text-ios-gray-500' : 'text-ios-gray-400'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            © {new Date().getFullYear()} Civic Education Kenya. All rights reserved.
          </motion.p>
        </TextShadowLayer>
      </div>
    </div>
  );
};

export default IEBCOfficeSplash;
