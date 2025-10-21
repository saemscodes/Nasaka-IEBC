import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '../../hooks/useGeolocation';
import LoadingSpinner from '../../components/IEBCOffice/LoadingSpinner';
import AppFooter from '@/components/UI/AppFooter';
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
      className={`absolute top-6 right-6 z-20 w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition-all duration-300 ${
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

// Animated Logo Component with Option 4 Animation
const AnimatedLogo = () => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="logo-container relative flex items-center justify-center w-32 h-32 mx-auto mb-2 cursor-pointer"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileTap={{ scale: 0.95 }}
    >
      {/* Ping Background */}
      <div className={`absolute inset-0 rounded-full animate-ping ${
        theme === 'dark' 
          ? 'bg-ios-blue/30' 
          : 'bg-ios-blue/20'
      }`} />
      
      {/* Main Logo Container */}
      <motion.div
        className={`absolute inset-4 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          theme === 'dark'
            ? 'bg-ios-blue-600 shadow-ios-blue/25'
            : 'bg-ios-blue shadow-ios-blue/25'
        } ${
          isHovered ? 'logo-svg-bounce' : ''
        }`}
        animate={{
          scale: isHovered ? [1, 1.1, 1.05] : 1,
          boxShadow: isHovered ? [
            '0 0 20px rgba(0, 122, 255, 0.3)',
            '0 0 40px rgba(0, 122, 255, 0.6)',
            '0 0 20px rgba(0, 122, 255, 0.3)'
          ] : '0 4px 12px rgba(0, 122, 255, 0.25)'
        }}
        transition={{
          duration: 0.5,
          ease: "easeInOut"
        }}
      >
        <svg
          version="1.0"
          xmlns="http://www.w3.org/2000/svg"
          width="1080.000000pt"
          height="1080.000000pt"
          viewBox="0 0 1080.000000 1080.000000"
          preserveAspectRatio="xMidYMid meet"
          className="w-16 h-16 mx-auto my-auto transition-all duration-300"
          fill="#ffffff"
        >
          <g
            transform="translate(0.000000,1080.000000) scale(0.100000,-0.100000)"
            stroke="none"
          >
            <motion.path 
              d="M5215 10794 c-1281 -58 -2459 -699 -3203 -1743 -414 -581 -667 -1245 -747 -1961 -17 -159 -20 -594 -4 -775 33 -391 130 -800 284 -1205 81 -213 310 -679 437 -890 302 -501 556 -849 1011 -1385 1622 -1913 2394 -2819 2402 -2821 10 -3 2317 2755 2593 3100 501 626 822 1112 1077 1631 264 538 406 1009 461 1528 20 185 14 627 -10 837 -93 795 -399 1528 -898 2148 -118 147 -438 471 -582 590 -628 519 -1402 843 -2211 926 -147 15 -474 26 -610 20z m539 -900 c1104 -122 2064 -793 2565 -1792 88 -175 190 -450 240 -647 27 -108 66 -325 82 -460 21 -170 18 -630 -4 -780 -92 -621 -320 -1152 -694 -1620 -113 -142 -358 -387 -498 -499 -880 -703 -2048 -909 -3105 -547 -477 163 -897 426 -1255 785 -549 551 -876 1253 -944 2026 -16 180 -14 502 3 651 108 901 559 1691 1278 2240 456 348 1025 576 1603 643 170 20 554 20 729 0z"
              animate={{
                scale: isHovered ? 1.1 : 1,
                fill: isHovered ? "#ffffff" : "#ffffff"
              }}
              transition={{
                scale: { duration: 0.3, delay: 0 },
                fill: { duration: 0.3 }
              }}
            />
            <motion.path 
              d="M5245 8729 c-789 -74 -1473 -620 -1720 -1374 -80 -244 -90 -311 -90 -625 0 -261 2 -281 28 -403 51 -237 143 -468 265 -665 312 -502 836 -843 1425 -927 138 -20 430 -19 566 1 569 83 1074 402 1393 880 78 117 187 342 232 477 105 315 129 684 66 1010 -21 110 -59 249 -85 311 l-17 39 -167 -168 -168 -167 8 -37 c55 -226 51 -503 -11 -747 -206 -818 -1039 -1335 -1865 -1158 -622 134 -1091 609 -1225 1241 -27 126 -38 395 -21 514 77 538 411 995 895 1225 223 105 384 143 636 151 150 5 193 2 299 -16 294 -50 571 -182 798 -379 46 -40 86 -72 90 -72 5 0 73 65 153 145 l144 144 -24 27 c-40 42 -206 179 -283 232 -376 259 -860 384 -1322 341z"
              animate={{
                scale: isHovered ? 1.08 : 1,
                fill: isHovered ? "#ffffff" : "#ffffff"
              }}
              transition={{
                scale: { duration: 0.3, delay: 0.05 },
                fill: { duration: 0.3 }
              }}
            />
            <motion.path 
              d="M7352 8350 c-159 -42 -124 -11 -1007 -891 l-810 -808 -275 273 c-296 293 -334 323 -470 362 -95 27 -234 25 -330 -5 -93 -28 -110 -37 -189 -97 l-63 -47 629 -629 c672 -672 661 -663 734 -639 25 8 344 321 1192 1169 l1159 1159 -49 40 c-138 116 -342 160 -521 113z"
              animate={{
                scale: isHovered ? 1.06 : 1,
                fill: isHovered ? "#ffffff" : "#ffffff"
              }}
              transition={{
                scale: { duration: 0.3, delay: 0.1 },
                fill: { duration: 0.3 }
              }}
            />
          </g>
        </svg>
      </motion.div>

      {/* Glow Effect */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        animate={{
          opacity: isHovered ? [0.3, 0.8, 0.3] : 0,
          scale: isHovered ? [1, 1.2, 1] : 1
        }}
        transition={{
          duration: 2,
          repeat: isHovered ? Infinity : 0,
          ease: "easeInOut"
        }}
        style={{
          background: `radial-gradient(circle, rgba(0, 122, 255, 0.4) 0%, transparent 70%)`
        }}
      />
    </motion.div>
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
          {/* Animated Logo */}
          <AnimatedLogo />
          
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

      {/* Footer */}
      <AppFooter />

      {/* Add the CSS for the logo animation */}
      <style jsx>{`
        .logo-svg-bounce {
          animation: bounceGentle 1s ease, glow 2s ease-in-out infinite;
        }

        @keyframes bounceGentle {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
          60% { transform: translateY(-4px); }
        }

        @keyframes glow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(0, 122, 255, 0.3),
                        0 4px 12px rgba(0, 122, 255, 0.25);
          }
          50% { 
            box-shadow: 0 0 40px rgba(0, 122, 255, 0.6),
                        0 8px 25px rgba(0, 122, 255, 0.4);
          }
        }
      `}</style>
    </div>
  );
};

export default IEBCOfficeSplash;
