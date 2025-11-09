// src/components/IEBCOffice/OfficeBottomSheet.jsx
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { calculateDistance } from '@/utils/geoUtils';
import { useTheme } from '@/contexts/ThemeContext';
import {
  buildUrlsFor,
  openWithAppFallback,
  getProviderColors,
  trackProviderOpen,
  UBER_PRODUCTS
} from '@/utils/rideLinks';
import {
  calculateAllFares,
  getCheapestOption,
  formatFare,
  estimateTravelTime,
  getCurrentTrafficCondition,
  getTrafficInfo,
  FARE_DISCLAIMER
} from '@/utils/kenyaFareCalculator';
import UberModal from './UberModal';

const OfficeBottomSheet = ({
  office,
  userLocation,
  currentRoute,
  routingError,
  state = 'peek',
  onExpand,
  onCollapse,
  onClose
}) => {
  const [dragY, setDragY] = useState(0);
  const [showUberModal, setShowUberModal] = useState(false);
  const [showFareDetails, setShowFareDetails] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragControls = useDragControls();
  const sheetRef = useRef(null);
  const backdropRef = useRef(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Handle backdrop click to minimize
  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current && state === 'expanded' && !showUberModal) {
      onCollapse?.();
    }
  };

  // Handle escape key to minimize
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && state === 'expanded' && !showUberModal) {
        onCollapse?.();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [state, showUberModal, onCollapse]);

  const distanceToOffice = useMemo(() => {
    if (!office || !userLocation?.latitude || !userLocation?.longitude) {
      return null;
    }
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      office.latitude,
      office.longitude
    );
  }, [office, userLocation]);

  const fareEstimates = useMemo(() => {
    if (!distanceToOffice) return null;

    const estimatedMinutes = currentRoute?.[0]?.summary?.totalTime 
      ? Math.round(currentRoute[0].summary.totalTime / 60)
      : estimateTravelTime(distanceToOffice);

    return calculateAllFares(distanceToOffice, estimatedMinutes, 'nairobi');
  }, [distanceToOffice, currentRoute]);

  const cheapestFare = useMemo(() => {
    if (!fareEstimates) return null;
    return getCheapestOption(fareEstimates);
  }, [fareEstimates]);

  const trafficInfo = getTrafficInfo();

  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    const threshold = 100;
    
    if (info.offset.y > threshold) {
      if (state === 'expanded') {
        onCollapse?.();
      } else {
        onClose?.();
      }
    } else if (info.offset.y < -threshold && state === 'peek') {
      onExpand?.();
    }
    
    setDragY(0);
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const coordsAvailable = office && office.latitude != null && office.longitude != null;
  const pickup = userLocation && userLocation.latitude != null && userLocation.longitude != null
    ? { lat: userLocation.latitude, lng: userLocation.longitude }
    : null;
  const destination = coordsAvailable 
    ? { latitude: office.latitude, longitude: office.longitude } 
    : null;

  const openProvider = (provider, productType = null) => {
    const urls = buildUrlsFor(provider, { pickup, destination, productType });
    openWithAppFallback(urls.app, urls.web);
    trackProviderOpen(provider, { productType, source: 'bottom_sheet' });
  };

  const openUber = (productType = null) => {
    if (!productType) {
      setShowUberModal(true);
      return;
    }
    openProvider('uber', productType);
    setShowUberModal(false);
  };

  const openBolt = () => openProvider('bolt');
  const openGoogleMaps = () => openProvider('google');
  const openAppleMaps = () => openProvider('apple');

  const copyCoords = async () => {
    if (!coordsAvailable) return;
    const coords = `${office.latitude},${office.longitude}`;
    try {
      await navigator.clipboard.writeText(coords);
      alert('Coordinates copied to clipboard!');
    } catch (err) {
      const fallback = prompt('Copy coordinates:', coords);
      if (fallback !== null) {
        try { await navigator.clipboard.writeText(coords); } catch (_) {}
      }
    }
  };

  const handlePeekTap = () => {
    if (state === 'peek' && !isDragging) {
      onExpand?.();
    }
  };

  if (!office && state === 'hidden') return null;

  const googleColors = getProviderColors('google', isDark);
  const appleColors = getProviderColors('apple', isDark);
  const uberColors = getProviderColors('uber', isDark);
  const boltColors = getProviderColors('bolt', isDark);

  return (
    <>
      {/* Backdrop for tapping outside - Only when expanded and no modal open */}
      <AnimatePresence>
        {state === 'expanded' && !showUberModal && (
          <motion.div
            ref={backdropRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="office-bottom-sheet-backdrop active backdrop-transition"
            onClick={handleBackdropClick}
            style={{ cursor: 'pointer' }}
          />
        )}
      </AnimatePresence>

      {/* Main Bottom Sheet */}
      <AnimatePresence>
        {office && state !== 'hidden' && (
          <motion.div
            ref={sheetRef}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: state === 'peek' ? 'calc(100% - 80px)' : 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className={`office-bottom-sheet ${state} ${
              isDark
                ? 'bg-card border-border text-foreground'
                : 'bg-white border-ios-gray-200 text-ios-gray-900'
            } transition-colors duration-300`}
            style={{ y: dragY }}
          >
            <div
              className={`bottom-sheet-handle ${
                isDark ? 'bg-ios-gray-400' : 'bg-ios-gray-300'
              } transition-colors duration-300`}
              onPointerDown={e => dragControls.start(e)}
            />

            <div className="px-5 py-3 cursor-pointer" onClick={handlePeekTap}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg line-clamp-1 transition-colors duration-300 ${
                    isDark ? 'text-white' : 'text-foreground'
                  }`}>
                    {office.office_name || office.constituency_name || 'IEBC Office'}
                  </h3>
                  <p className={`text-sm mt-1 line-clamp-1 transition-colors duration-300 ${
                    isDark ? 'text-ios-gray-300' : 'text-muted-foreground'
                  }`}>
                    {office.constituency_name && office.county
                      ? `${office.constituency_name}, ${office.county}`
                      : office.county || office.constituency_name || 'Location'}
                  </p>
                </div>
                
                {distanceToOffice && (
                  <div className="ml-4 text-right">
                    <span className={`text-sm font-medium transition-colors duration-300 ${
                      isDark ? 'text-ios-blue-400' : 'text-primary'
                    }`}>
                      {distanceToOffice.toFixed(1)} km
                    </span>
                    {cheapestFare && (
                      <p className={`text-xs mt-1 font-semibold transition-colors duration-300 ${
                        isDark ? 'text-green-400' : 'text-green-600'
                      }`}>
                        {formatFare(cheapestFare.total)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {state === 'expanded' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.1 }}
                className="bottom-sheet-content green-scrollbar"
              >
                <div className="space-y-4">
                  <div className={`border-b pb-4 transition-colors duration-300 ${
                    isDark ? 'border-ios-gray-600' : 'border-border'
                  }`}>
                    <h2 className={`text-2xl font-bold transition-colors duration-300 ${
                      isDark ? 'text-white' : 'text-foreground'
                    }`}>
                      {office.office_name || office.constituency_name || 'IEBC Office'}
                    </h2>
                    {office.office_type && (
                      <span className={`inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full transition-colors duration-300 ${
                        isDark
                          ? 'bg-ios-blue/30 text-ios-blue-400'
                          : 'bg-primary/20 text-primary'
                      }`}>
                        {office.office_type}
                      </span>
                    )}
                  </div>

                  {fareEstimates && (
                    <div className={`rounded-xl p-4 border transition-colors duration-300 ${
                      isDark
                        ? 'bg-gradient-to-br from-green-900/20 to-blue-900/20 border-green-700/30'
                        : 'bg-gradient-to-br from-green-50 to-blue-50 border-green-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">💰</span>
                          <div>
                            <h4 className={`text-sm font-semibold ${
                              isDark ? 'text-green-300' : 'text-green-800'
                            }`}>
                              Estimated Ride Cost
                            </h4>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className={`text-xs ${trafficInfo.color}`}>
                                {trafficInfo.icon} {trafficInfo.description}
                              </span>
                              <span className={`text-xs ${
                                isDark ? 'text-ios-gray-400' : 'text-gray-600'
                              }`}>
                                {distanceToOffice.toFixed(1)} km
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowFareDetails(!showFareDetails)}
                          className={`text-xs px-3 py-1 rounded-full transition-colors ${
                            isDark 
                              ? 'bg-ios-gray-700 text-ios-gray-300 hover:bg-ios-gray-600' 
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                          }`}
                        >
                          {showFareDetails ? 'Hide' : 'Show All'}
                        </button>
                      </div>

                      {cheapestFare && (
                        <div className={`rounded-lg p-3 mb-3 ${
                          isDark ? 'bg-black/30' : 'bg-white/80'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-xs font-medium ${
                                isDark ? 'text-ios-gray-300' : 'text-gray-600'
                              }`}>
                                💡 Cheapest Option
                              </p>
                              <p className={`text-lg font-bold ${
                                isDark ? 'text-white' : 'text-gray-900'
                              }`}>
                                {cheapestFare.icon} {cheapestFare.displayName}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-2xl font-bold ${
                                isDark ? 'text-green-400' : 'text-green-600'
                              }`}>
                                {formatFare(cheapestFare.total)}
                              </p>
                              <p className={`text-xs ${
                                isDark ? 'text-ios-gray-400' : 'text-gray-500'
                              }`}>
                                ~{cheapestFare.estimatedMinutes} min
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <AnimatePresence>
                        {showFareDetails && fareEstimates && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 mt-3"
                          >
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(fareEstimates.uber).map(([key, fare]) => (
                                <div
                                  key={key}
                                  className={`p-2 rounded-lg text-center ${
                                    isDark ? 'bg-black/20' : 'bg-white/60'
                                  }`}
                                >
                                  <div className="text-lg">{fare.icon}</div>
                                  <p className={`text-xs font-medium ${
                                    isDark ? 'text-white' : 'text-gray-900'
                                  }`}>
                                    {fare.displayName}
                                  </p>
                                  <p className={`text-sm font-bold ${
                                    isDark ? 'text-green-400' : 'text-green-600'
                                  }`}>
                                    {formatFare(fare.total)}
                                  </p>
                                </div>
                              ))}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(fareEstimates.bolt).map(([key, fare]) => (
                                <div
                                  key={key}
                                  className={`p-2 rounded-lg text-center ${
                                    isDark ? 'bg-black/20' : 'bg-white/60'
                                  }`}
                                >
                                  <div className="text-lg">{fare.icon}</div>
                                  <p className={`text-xs font-medium ${
                                    isDark ? 'text-white' : 'text-gray-900'
                                  }`}>
                                    {fare.displayName}
                                  </p>
                                  <p className={`text-sm font-bold ${
                                    isDark ? 'text-green-400' : 'text-green-600'
                                  }`}>
                                    {formatFare(fare.total)}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {fareEstimates.traffic.multiplier > 1 && (
                              <div className={`text-xs p-2 rounded mt-2 ${
                                isDark 
                                  ? 'bg-orange-900/20 text-orange-300' 
                                  : 'bg-orange-50 text-orange-700'
                              }`}>
                                ⚠️ {fareEstimates.traffic.description} - Prices include traffic surcharge
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <p className={`text-xs mt-3 italic ${
                        isDark ? 'text-ios-gray-400' : 'text-gray-500'
                      }`}>
                        {FARE_DISCLAIMER.en}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {office.constituency_name && (
                      <div className="flex items-center text-sm">
                        <span className={isDark ? 'text-ios-gray-400' : 'text-gray-500'}>
                          📍 {office.constituency_name}, {office.county}
                        </span>
                      </div>
                    )}
                    {office.phone && (
                      <div className="flex items-center text-sm">
                        <a href={`tel:${office.phone}`} className={`hover:underline ${
                          isDark ? 'text-ios-blue-300' : 'text-blue-600'
                        }`}>
                          📞 {office.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {distanceToOffice && (
                    <div className={`rounded-xl p-4 border transition-colors duration-300 ${
                      isDark
                        ? 'bg-ios-blue/20 border-ios-blue/30'
                        : 'bg-primary/10 border-primary/20'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium transition-colors duration-300 ${
                            isDark ? 'text-ios-gray-200' : 'text-foreground'
                          }`}>Distance</p>
                          <p className={`text-2xl font-bold mt-1 transition-colors duration-300 ${
                            isDark ? 'text-ios-blue-400' : 'text-primary'
                          }`}>
                            {distanceToOffice.toFixed(1)} km
                          </p>
                        </div>
                        {currentRoute && currentRoute[0] && (
                          <div className="text-right">
                            <p className={`text-sm font-medium transition-colors duration-300 ${
                              isDark ? 'text-ios-gray-200' : 'text-foreground'
                            }`}>Drive Time</p>
                            <p className={`text-2xl font-bold mt-1 transition-colors duration-300 ${
                              isDark ? 'text-ios-blue-400' : 'text-primary'
                            }`}>
                              {Math.round(currentRoute[0].summary.totalTime / 60)} min
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <h4 className={`text-sm font-semibold mb-2 ${
                      isDark ? 'text-ios-gray-200' : 'text-gray-900'
                    }`}>Get There</h4>

                    {showUberModal && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`rounded-xl p-3 border mb-3 ${
                          isDark ? 'bg-ios-gray-800 border-ios-gray-700' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <p className={`text-xs font-medium mb-2 ${
                          isDark ? 'text-ios-gray-300' : 'text-gray-700'
                        }`}>Choose Uber Service:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {fareEstimates && Object.entries(fareEstimates.uber).map(([key, fare]) => (
                            <button
                              key={key}
                              onClick={() => openUber(UBER_PRODUCTS[key.toUpperCase().replace('UBER', '')])}
                              className="text-xs py-2 px-3 rounded-lg bg-black text-white hover:bg-gray-900 flex flex-col items-start"
                            >
                              <span className="font-semibold">{fare.displayName}</span>
                              <span className="text-green-400 text-xs">{formatFare(fare.total)}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowUberModal(false)}
                          className={`text-xs mt-2 w-full py-1 rounded ${
                            isDark ? 'text-ios-gray-400' : 'text-gray-600'
                          }`}
                        >
                          Cancel
                        </button>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => openUber()}
                        className="w-full font-semibold py-3 px-4 rounded-2xl flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 shadow-sm bg-black text-white hover:bg-gray-900"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">🚗</span>
                          <span className="text-sm">Uber</span>
                        </div>
                        {cheapestFare && cheapestFare.provider === 'uber' && (
                          <span className="text-xs text-green-400">{formatFare(cheapestFare.total)}</span>
                        )}
                      </button>

                      <button
                        onClick={openBolt}
                        className="w-full font-semibold py-3 px-4 rounded-2xl flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 shadow-sm bg-[#34D186] text-black hover:bg-[#2BBD75]"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">⚡</span>
                          <span className="text-sm">Bolt</span>
                        </div>
                        {cheapestFare && cheapestFare.provider === 'bolt' && (
                          <span className="text-xs text-gray-800">{formatFare(cheapestFare.total)}</span>
                        )}
                      </button>

                      <button
                        onClick={openGoogleMaps}
                        className={`w-full font-semibold py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm ${
                          isDark
                            ? 'bg-[#1F1F1F] text-white hover:bg-[#2A2A2A] border border-gray-700'
                            : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        <span className="text-lg">🗺️</span>
                        <span className="text-sm">Google Maps</span>
                      </button>

                      <button
                        onClick={openAppleMaps}
                        className={`w-full font-semibold py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-sm ${
                          isDark
                            ? 'bg-[#1C1C1E] text-white hover:bg-[#2C2C2E] border border-gray-700'
                            : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        <span className="text-lg">🍎</span>
                        <span className="text-sm">Apple Maps</span>
                      </button>
                    </div>

                    {office.latitude && office.longitude && (
                      <button
                        onClick={copyCoords}
                        className={`w-full font-medium py-3 px-6 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 duration-300 ${
                          isDark
                            ? 'bg-ios-gray-700 hover:bg-ios-gray-600 text-ios-gray-200'
                            : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 20h2a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v2" />
                        </svg>
                        <span>Copy Coordinates</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className={`sticky bottom-0 pt-4 pb-2 mt-6 border-t transition-colors duration-300 ${
                  isDark
                    ? 'bg-card border-ios-gray-600'
                    : 'bg-background border-border'
                }`}>
                  <button
                    onClick={onClose}
                    className={`w-full font-medium py-3 px-6 rounded-2xl transition-all active:scale-95 duration-300 ${
                      isDark
                        ? 'bg-ios-gray-700 hover:bg-ios-gray-600 text-ios-gray-200'
                        : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                    }`}
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <UberModal
        isOpen={showUberModal}
        onClose={() => setShowUberModal(false)}
        onProductSelect={(product) => openUber(product.productType)}
        pickup={pickup}
        destination={destination}
        fareEstimates={fareEstimates}
      />
    </>
  );
};

export default OfficeBottomSheet;
