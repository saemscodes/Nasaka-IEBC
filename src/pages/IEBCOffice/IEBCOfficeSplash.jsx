import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '../../hooks/useGeolocation';
import LoadingSpinner from '../../components/IEBCOffice/LoadingSpinner';

const BackgroundLayers = ({ className = "" }) => {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 will-change-transform">
        <div className="bg-peek absolute inset-0" />
      </div>

      <div className="absolute inset-0">
        <div className="bg-pattern absolute inset-0" />
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <div className="bg-vignette absolute inset-0" />
      </div>
    </div>
  );
};

const IEBCOfficeSplash = () => {
  const navigate = useNavigate();
  const { location, error, loading, requestLocation } = useGeolocation();
  const [showError, setShowError] = useState(false);

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
    <motion.div
      className="relative flex flex-col items-center justify-center min-h-screen bg-white px-6 overflow-hidden"
      variants={splashVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <BackgroundLayers />
      
      <div className="relative z-10 text-center max-w-md w-full">
        <motion.div
          className="relative flex items-center justify-center w-32 h-32 mx-auto mb-2"
          variants={iconVariants}
          initial="initial"
          animate="animate"
        >
          <div className="absolute inset-0 bg-ios-blue/20 rounded-full animate-ping" />
          <div className="absolute inset-4 bg-ios-blue rounded-full flex items-center justify-center shadow-lg">
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
          <h1 className="text-6xl font-black text-ios-gray-900 mb-2 tracking-tight leading-none">
            NASAKA
          </h1>
          <div className="flex items-center justify-center space-x-2">
            <div className="h-px w-8 bg-ios-blue/40"></div>
            <h2 className="text-xl font-semibold text-ios-blue tracking-wide">
              IEBC
            </h2>
            <div className="h-px w-8 bg-ios-blue/40"></div>
          </div>
        </motion.div>

        <motion.h2
          className="text-2xl font-semibold text-ios-gray-900 mb-3"
          variants={subheadlineVariants}
          initial="initial"
          animate="animate"
        >
          Find Your Nearest IEBC Office
        </motion.h2>

        <motion.p
          className="text-ios-gray-600 mb-8 text-base"
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
              <div className="bg-ios-red/10 border border-ios-red/20 rounded-xl p-4">
                <p className="text-ios-red text-sm font-medium">
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
            className="bg-ios-blue text-white px-8 py-4 rounded-2xl font-semibold text-base disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-ios-blue/25"
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
            className="text-ios-blue px-8 py-4 rounded-2xl font-medium text-base border border-ios-gray-300 bg-white"
          >
            Search Manually
          </motion.button>
        </motion.div>

        <motion.p
          className="text-ios-gray-500 text-xs mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Your location data is processed locally and never stored on our servers.
        </motion.p>
      </div>
    </motion.div>
  );
};

export default IEBCOfficeSplash;
