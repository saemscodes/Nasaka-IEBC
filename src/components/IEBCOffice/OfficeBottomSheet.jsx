// src/components/IEBCOffice/OfficeBottomSheet.jsx
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { calculateDistance } from '@/utils/geoUtils';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
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
import OfflineRouteDownloader from './OfflineRouteDownloader';
import i18next from 'i18next';
import { useNavigate } from 'react-router-dom';
import { slugify } from '@/components/SEO/SEOHead';
const OfficeBottomSheet = ({
  office,
  userLocation,
  currentRoute,
  routingError,
  travelInsights,
  state = 'peek',
  onExpand,
  onCollapse,
  onClose,
  hasLocationAccess = false
}) => {
  const navigate = useNavigate();
  const [dragY, setDragY] = useState(0);
  const [showUberModal, setShowUberModal] = useState(false);
  const [showFareDetails, setShowFareDetails] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsingForModal, setIsCollapsingForModal] = useState(false);
  const dragControls = useDragControls();
  const sheetRef = useRef(null);
  const backdropRef = useRef(null);
  const { theme } = useTheme();
  const { t } = useTranslation('nasaka');
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

  // Calculate distance to office - ONLY if we have location access
  const distanceToOffice = useMemo(() => {
    if (!hasLocationAccess || !office || !userLocation?.latitude || !userLocation?.longitude) {
      return null;
    }
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      office.latitude,
      office.longitude
    );
  }, [hasLocationAccess, office, userLocation]);

  // Calculate fare estimates - ONLY if we have location access
  const fareEstimates = useMemo(() => {
    if (!hasLocationAccess || !distanceToOffice) return null;

    const estimatedMinutes = currentRoute?.[0]?.summary?.totalTime
      ? Math.round(currentRoute[0].summary.totalTime / 60)
      : estimateTravelTime(distanceToOffice);

    return calculateAllFares(distanceToOffice, estimatedMinutes, 'nairobi');
  }, [hasLocationAccess, distanceToOffice, currentRoute]);

  // Get cheapest option - ONLY if we have location access
  const cheapestFare = useMemo(() => {
    if (!hasLocationAccess || !fareEstimates) return null;
    return getCheapestOption(fareEstimates);
  }, [hasLocationAccess, fareEstimates]);

  // Get traffic condition - ONLY if we have location access
  const trafficInfo = hasLocationAccess ? getTrafficInfo() : null;

  // Handle drag end
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

  // Coordinates setup - pickup only available if location access granted
  const coordsAvailable = office && office.latitude != null && office.longitude != null;
  const pickup = hasLocationAccess && userLocation && userLocation.latitude != null && userLocation.longitude != null
    ? { lat: userLocation.latitude, lng: userLocation.longitude }
    : null;
  const destination = coordsAvailable
    ? { latitude: office.latitude, longitude: office.longitude }
    : null;

  // Provider opener functions - conditional based on location access
  const openProvider = (provider, productType = null) => {
    const urls = buildUrlsFor(provider, {
      pickup: hasLocationAccess ? pickup : null,
      destination,
      productType
    });
    openWithAppFallback(urls.app, urls.web);
    trackProviderOpen(provider, {
      productType,
      source: 'bottom_sheet',
      hasLocationAccess,
      hasPickup: !!pickup,
      hasDestination: !!destination
    });
  };

  const openUber = (productType = null) => {
    // If we have a product type, open directly (from modal selection)
    if (productType) {
      openProvider('uber', productType);
      setShowUberModal(false);
      return;
    }

    // If we're in expanded state and need to show modal, collapse first with smooth animation
    if (state === 'expanded' && hasLocationAccess && fareEstimates) {
      setIsCollapsingForModal(true);
      onCollapse?.();

      // Wait for collapse animation to complete before showing modal
      setTimeout(() => {
        setShowUberModal(true);
        setIsCollapsingForModal(false);
      }, 350); // Match the spring animation duration
    } else {
      // If already peeked or no location access, open directly or show modal immediately
      if (!hasLocationAccess || !fareEstimates) {
        openProvider('uber');
      } else {
        setShowUberModal(true);
      }
    }
  };

  const openBolt = () => openProvider('bolt');
  const openGoogleMaps = () => openProvider('google');
  const openAppleMaps = () => openProvider('apple');

  // Copy coordinates
  const copyCoords = async () => {
    if (!coordsAvailable) return;
    const coords = `${office.latitude},${office.longitude}`;
    try {
      await navigator.clipboard.writeText(coords);
      alert(t('bottomSheet.coordinatesCopied', 'Coordinates copied to clipboard!'));
    } catch (err) {
      const fallback = prompt(t('bottomSheet.copyCoordinatesPrompt', 'Copy coordinates:'), coords);
      if (fallback !== null) {
        try { await navigator.clipboard.writeText(coords); } catch (_) { }
      }
    }
  };

  // Handle tap on peek area
  const handlePeekTap = () => {
    if (state === 'peek' && !isDragging) {
      onExpand?.();
    }
  };

  if (!office && state === 'hidden') return null;

  // Get provider colors
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
            animate={{
              y: state === 'peek' ? 'calc(100% - 80px)' : 0,
              transition: {
                type: 'spring',
                stiffness: 400,
                damping: 40
              }
            }}
            exit={{ y: '100%' }}
            className={`office-bottom-sheet ${state} ${isDark
              ? 'bg-card border-border text-foreground'
              : 'bg-white border-ios-gray-200 text-ios-gray-900'
              } transition-colors duration-300`}
            style={{ y: dragY }}
          >
            {/* Drag Handle */}
            <div
              className={`bottom-sheet-handle ${isDark ? 'bg-ios-gray-400' : 'bg-ios-gray-300'
                } transition-colors duration-300`}
              onPointerDown={e => dragControls.start(e)}
            />

            {/* Peek Preview */}
            <div className="px-5 py-3 cursor-pointer" onClick={handlePeekTap}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg line-clamp-1 transition-colors duration-300 ${isDark ? 'text-white' : 'text-foreground'
                    }`}>
                    {office.office_name || office.constituency_name || t('office.officeName', 'IEBC Office')}
                  </h3>
                  <p className={`text-sm mt-1 line-clamp-1 transition-colors duration-300 ${isDark ? 'text-ios-gray-300' : 'text-muted-foreground'
                    }`}>
                    {office.constituency_name && office.county
                      ? `${office.constituency_name}, ${office.county}`
                      : office.county || office.constituency_name || t('office.location', 'Location')}
                  </p>
                </div>

                {/* Show distance and fare ONLY if we have location access */}
                {hasLocationAccess && distanceToOffice && (
                  <div className="ml-4 text-right">
                    <span className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                      }`}>
                      {t('office.distance', { distance: distanceToOffice.toFixed(1) })}
                    </span>
                    {cheapestFare && (
                      <p className={`text-xs mt-1 font-semibold transition-colors duration-300 ${isDark ? 'text-green-400' : 'text-green-600'
                        }`}>
                        {formatFare(cheapestFare.total)}
                      </p>
                    )}
                  </div>
                )}
                {/* Show different message when no location access */}
                {!hasLocationAccess && (
                  <div className="ml-4 text-right">
                    <span className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                      }`}>
                      {t('office.tapForDirections', 'Tap for directions')}
                    </span>
                    <p className={`text-xs mt-1 transition-colors duration-300 ${isDark ? 'text-ios-gray-400' : 'text-muted-foreground'
                      }`}>
                      {t('office.noLocationAccess', 'No location access')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {state === 'expanded' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.1 }}
                className="bottom-sheet-content green-scrollbar"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className={`border-b pb-4 transition-colors duration-300 ${isDark ? 'border-ios-gray-600' : 'border-border'
                    }`}>
                    <h2 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-foreground'
                      }`}>
                      {office.office_name || office.constituency_name || t('office.officeName', 'IEBC Office')}
                    </h2>
                    {office.office_type && (
                      <span className={`inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full transition-colors duration-300 ${isDark
                        ? 'bg-ios-blue/30 text-ios-blue-400'
                        : 'bg-primary/20 text-primary'
                        }`}>
                        {office.office_type}
                      </span>
                    )}
                  </div>

                  {/* LOCATION ACCESS WARNING - SHOW WHEN NO ACCESS */}
                  {!hasLocationAccess && (
                    <div className={`rounded-xl p-4 border transition-colors duration-300 ${isDark
                      ? 'bg-yellow-900/20 border-yellow-700/30'
                      : 'bg-yellow-50 border-yellow-200'
                      }`}>
                      <div className="flex items-start space-x-3">
                        <span className="text-xl mt-0.5">📍</span>
                        <div className="flex-1">
                          <h4 className={`text-sm font-semibold mb-1 ${isDark ? 'text-yellow-300' : 'text-yellow-800'
                            }`}>
                            {t('bottomSheet.locationAccessRequired', 'Location Access Required')}
                          </h4>
                          <p className={`text-xs ${isDark ? 'text-yellow-200' : 'text-yellow-700'
                            }`}>
                            {t('bottomSheet.locationAccessDesc', 'Enable location access to see fare estimates, get directions from your current location, and find the nearest route to this office.')}
                          </p>
                          <button
                            onClick={() => window.location.reload()}
                            className={`mt-2 text-xs px-3 py-1 rounded-full font-medium transition-colors ${isDark
                              ? 'bg-yellow-700 hover:bg-yellow-600 text-white'
                              : 'bg-yellow-200 hover:bg-yellow-300 text-yellow-900'
                              }`}
                          >
                            {t('bottomSheet.enableLocationAccess', 'Enable Location Access')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FARE ESTIMATES CARD - ONLY SHOW IF LOCATION ACCESS GRANTED */}
                  {hasLocationAccess && fareEstimates && (
                    <div className={`rounded-xl p-4 border transition-colors duration-300 ${isDark
                      ? 'bg-gradient-to-br from-green-900/20 to-blue-900/20 border-green-700/30'
                      : 'bg-gradient-to-br from-green-50 to-blue-50 border-green-200'
                      }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">💰</span>
                          <div>
                            <h4 className={`text-sm font-semibold ${isDark ? 'text-green-300' : 'text-green-800'
                              }`}>
                              {t('bottomSheet.estimatedRideCost', 'Estimated Ride Cost')}
                            </h4>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className={`text-xs ${trafficInfo?.color || 'text-gray-500'}`}>
                                {trafficInfo?.icon || '🚗'} {trafficInfo?.description || t('bottomSheet.normalTraffic', 'Normal traffic')}
                              </span>
                              <span className={`text-xs ${isDark ? 'text-ios-gray-400' : 'text-gray-600'
                                }`}>
                                {distanceToOffice?.toFixed(1)} km
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowFareDetails(!showFareDetails)}
                          className={`text-xs px-3 py-1 rounded-full transition-colors ${isDark
                            ? 'bg-ios-gray-700 text-ios-gray-300 hover:bg-ios-gray-600'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                            }`}
                        >
                          {showFareDetails ? t('bottomSheet.hide', 'Hide') : t('bottomSheet.showAll', 'Show All')}
                        </button>
                      </div>

                      {/* Cheapest Option Highlight */}
                      {cheapestFare && (
                        <div className={`rounded-lg p-3 mb-3 ${isDark ? 'bg-black/30' : 'bg-white/80'
                          }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-xs font-medium ${isDark ? 'text-ios-gray-300' : 'text-gray-600'
                                }`}>
                                💡 {t('bottomSheet.cheapestOption', 'Cheapest Option')}
                              </p>
                              <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                {cheapestFare.icon} {cheapestFare.displayName}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-2xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'
                                }`}>
                                {formatFare(cheapestFare.total)}
                              </p>
                              <p className={`text-xs ${isDark ? 'text-ios-gray-400' : 'text-gray-500'
                                }`}>
                                ~{cheapestFare.estimatedMinutes} {t('bottomSheet.estimatedTime', 'min')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Detailed Fare Breakdown */}
                      <AnimatePresence>
                        {showFareDetails && fareEstimates && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 mt-3"
                          >
                            {/* Uber Options */}
                            <div>
                              <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-ios-gray-300' : 'text-gray-700'
                                }`}>
                                {t('bottomSheet.uberServices', 'Uber Services')}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(fareEstimates.uber).map(([key, fare]) => (
                                  <div
                                    key={key}
                                    className={`p-3 rounded-lg border ${isDark
                                      ? 'bg-black/20 border-gray-700'
                                      : 'bg-white/60 border-gray-200'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="flex items-center space-x-2">
                                          <span className="text-sm">{fare.icon}</span>
                                          <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'
                                            }`}>
                                            {fare.displayName}
                                          </span>
                                        </div>
                                        <p className={`text-xs mt-1 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'
                                          }`}>
                                          {fare.description}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'
                                          }`}>
                                          {formatFare(fare.total)}
                                        </p>
                                        {fare.trafficSurcharge > 0 && (
                                          <p className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-600'
                                            }`}>
                                            +{formatFare(fare.trafficSurcharge)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Bolt Options */}
                            {fareEstimates.bolt && (
                              <div>
                                <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-ios-gray-300' : 'text-gray-700'
                                  }`}>
                                  {t('bottomSheet.boltServices', 'Bolt Services')}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(fareEstimates.bolt).map(([key, fare]) => (
                                    <div
                                      key={key}
                                      className={`p-3 rounded-lg border ${isDark
                                        ? 'bg-black/20 border-gray-700'
                                        : 'bg-white/60 border-gray-200'
                                        }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm">{fare.icon}</span>
                                            <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'
                                              }`}>
                                              {fare.displayName}
                                            </span>
                                          </div>
                                          <p className={`text-xs mt-1 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'
                                            }`}>
                                            {fare.description}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'
                                            }`}>
                                            {formatFare(fare.total)}
                                          </p>
                                          {fare.trafficSurcharge > 0 && (
                                            <p className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-600'
                                              }`}>
                                              +{formatFare(fare.trafficSurcharge)}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Traffic Info */}
                            {fareEstimates.traffic?.multiplier > 1 && (
                              <div className={`text-xs p-2 rounded mt-2 ${isDark
                                ? 'bg-orange-900/20 text-orange-300'
                                : 'bg-orange-50 text-orange-700'
                                }`}>
                                ⚠️ {fareEstimates.traffic.description} - {t('bottomSheet.trafficSurchargeIncluded', 'Prices include traffic surcharge')}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Disclaimer */}
                      <p className={`text-xs mt-3 italic ${isDark ? 'text-ios-gray-400' : 'text-gray-500'
                        }`}>
                        {FARE_DISCLAIMER.en}
                      </p>
                    </div>
                  )}

                  {/* ── TRAVEL DIFFICULTY CARD ── */}
                  {travelInsights && (
                    <div className={`rounded-xl p-4 border transition-colors duration-300 ${isDark
                      ? 'bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-purple-700/30'
                      : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'
                      }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">🧭</span>
                          <div>
                            <h4 className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-800'}`}>
                              Travel Difficulty
                            </h4>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-ios-gray-400' : 'text-gray-600'}`}>
                              Real-time conditions analysis
                            </p>
                          </div>
                        </div>
                        <span className={`text-xl font-bold px-3 py-1 rounded-xl ${travelInsights.severity === 'low'
                          ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
                          : travelInsights.severity === 'medium'
                            ? isDark ? 'bg-yellow-900/40 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                            : isDark ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700'
                          }`}>
                          {travelInsights.score}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Weather */}
                        <div className={`p-2.5 rounded-lg ${isDark ? 'bg-black/20' : 'bg-white/60'
                          }`}>
                          <p className={`text-xs font-medium ${isDark ? 'text-ios-gray-300' : 'text-gray-700'}`}>
                            Weather
                          </p>
                          <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {travelInsights.weatherDesc}
                          </p>
                          {travelInsights.temperature !== null && (
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                              {travelInsights.temperature}°C
                            </p>
                          )}
                        </div>

                        {/* Wind */}
                        <div className={`p-2.5 rounded-lg ${isDark ? 'bg-black/20' : 'bg-white/60'
                          }`}>
                          <p className={`text-xs font-medium ${isDark ? 'text-ios-gray-300' : 'text-gray-700'}`}>
                            Conditions
                          </p>
                          {travelInsights.windSpeed !== null && (
                            <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              💨 {travelInsights.windSpeed} km/h
                            </p>
                          )}
                          {travelInsights.precipProb !== null && travelInsights.precipProb > 0 && (
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                              🌧️ {travelInsights.precipProb}% rain
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Score Explanation */}
                      <p className={`text-xs mt-3 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                        Score: 0 (easiest) → 100 (hardest). Factors: distance, time, traffic, weather.
                      </p>

                      {travelInsights.stale && (
                        <p className={`text-xs mt-1 italic ${isDark ? 'text-ios-gray-500' : 'text-gray-400'}`}>
                          ⏱ Some data may be stale — check again when online
                        </p>
                      )}
                    </div>
                  )}

                  {/* Location Information */}
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
                        <a href={`tel:${office.phone}`} className={`hover:underline ${isDark ? 'text-ios-blue-300' : 'text-blue-600'
                          }`}>
                          📞 {office.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Distance & Route Info - ONLY SHOW IF LOCATION ACCESS GRANTED */}
                  {hasLocationAccess && distanceToOffice && (
                    <div className={`rounded-xl p-4 border transition-colors duration-300 ${isDark
                      ? 'bg-ios-blue/20 border-ios-blue/30'
                      : 'bg-primary/10 border-primary/20'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-ios-gray-200' : 'text-foreground'
                            }`}>
                            {t('bottomSheet.distance', 'Distance')}
                          </p>
                          <p className={`text-2xl font-bold mt-1 transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                            }`}>
                            {distanceToOffice.toFixed(1)} km
                          </p>
                        </div>
                        {currentRoute && currentRoute[0] && (
                          <div className="text-right">
                            <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-ios-gray-200' : 'text-foreground'
                              }`}>
                              {t('bottomSheet.driveTime', 'Drive Time')}
                            </p>
                            <p
                              className={`text-2xl font-bold mt-1 transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                                }`}
                            >
                              {i18next.language === 'en'
                                ? `${Math.round(currentRoute[0].summary.totalTime / 60)} ${t('bottomSheet.estimatedTime', 'min')}`
                                : `${t('bottomSheet.estimatedTime', 'min')} ${Math.round(currentRoute[0].summary.totalTime / 60)}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* GET THERE SECTION - CONDITIONAL BASED ON LOCATION ACCESS */}
                  <div className="space-y-3 pt-4 border-t border-border/10">
                    <h4
                      className={`text-center text-xs font-bold tracking-[0.2em] uppercase mb-4 ${isDark ? 'text-ios-gray-400' : 'text-ios-gray-500'
                        }`}
                    >
                      {t('bottomSheet.navigationOptions', 'Get There')}
                    </h4>

                    {/* ✅ View Full Details Link (Full Ham) */}
                    <button
                      onClick={() => {
                        const countySlug = slugify(office.county);
                        let areaSlug = slugify(office.constituency_name || '');
                        if (areaSlug === countySlug) areaSlug = `${areaSlug}-town`;
                        navigate(`/${countySlug}/${areaSlug}`);
                      }}
                      className={`w-full mb-6 font-bold py-4 px-6 rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-[0.98] duration-300 shadow-xl ${isDark
                        ? 'bg-ios-blue-600 text-white shadow-ios-blue/20 border border-white/10'
                        : 'bg-ios-blue text-white shadow-ios-blue/15 border border-black/5'
                        }`}
                    >
                      <span className="text-sm">View Verified Office Records</span>
                      <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>

                    <div className={`grid gap-3 ${hasLocationAccess ? 'grid-cols-2' : 'grid-cols-1'
                      }`}>
                      {/* Uber Button */}
                      <button
                        onClick={() => openUber()}
                        className={`group relative overflow-hidden w-full py-4 px-4 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-all active:scale-[0.96] duration-300 backdrop-blur-3xl border shadow-lg ${isDark
                          ? 'bg-black/40 border-white/10 text-white'
                          : 'bg-gray-50/60 border-black/5 text-ios-gray-900'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 flex items-center justify-center">
                            <svg viewBox="0 0 512 512" className="w-5 h-5 fill-current">
                              <path d="M119.8,303.6c17.6,0,31.3-13.6,31.3-33.8V191.3h19.1V318.6H151.3V306.8a45.9,45.9,0,0,1-33.6,14c-27.3,0-48.2-19.8-48.2-49.8V191.4H88.6v78.5c0,20.5,13.4,33.7,31.2,33.7m64.6-112.3h18.4v46.4a46.11,46.11,0,0,1,32.9-13.8,48.45,48.45,0,0,1,0,96.9A46.52,46.52,0,0,1,202.6,307v11.6H184.4V191.3Zm50,113.2a32.2,32.2,0,1,0-32-32.4v.2a32,32,0,0,0,31.8,32.2h.2M339.3,224c26.7,0,46.4,20.5,46.4,48.2v6H310.3A31.09,31.09,0,0,0,341,304.6c10.7,0,19.8-4.4,26.7-13.6l13.3,9.8c-9.3,12.4-23.1,19.8-40,19.8-27.8,0-49.3-20.7-49.3-48.4-.1-26.2,20.5-48.2,47.6-48.2m-28.8,39.6H367c-3.1-14.2-14.5-23.6-28.2-23.6-13.5,0-25,9.5-28.3,23.6m124.4-21.4c-12,0-20.7,9.3-20.7,23.6v52.7H395.8V225.8H414v11.5c4.5-7.5,12-12.2,22.2-12.2h6.4v17.1Z" />
                            </svg>
                          </div>
                          <span className="text-sm font-bold tracking-tight">Uber</span>
                        </div>
                        {hasLocationAccess && cheapestFare && cheapestFare.provider === 'uber' ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
                            {formatFare(cheapestFare.total)}
                          </span>
                        ) : (
                          <span className={`text-[10px] opacity-60 font-medium`}>{t('bottomSheet.openApp', 'Open app')}</span>
                        )}
                      </button>

                      {/* Bolt Button */}
                      <button
                        onClick={openBolt}
                        className={`group relative overflow-hidden w-full py-4 px-4 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-all active:scale-[0.96] duration-300 backdrop-blur-3xl border shadow-lg ${isDark
                          ? 'bg-green-600/10 border-green-500/20 text-green-400'
                          : 'bg-green-50/60 border-green-200 text-green-800'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 flex items-center justify-center">
                            <svg viewBox="0 0 111.9 65" className="w-7 h-7 fill-current">
                              <path d="M30.4,23c4.4-7.1,2.2-16.4-4.8-20.8C23.2,0.8,20.5,0,17.7,0H0v48.9h19.9c8.3,0,15-6.8,15-15.1 C34.9,29.7,33.3,25.9,30.4,23z M11.4,11.5h6.3c2,0,3.6,1.6,3.6,3.6c0,2-1.6,3.6-3.6,3.6h-6.3V11.5z M19.9,37.4h-8.5v-7.2h8.5 c2,0,3.6,1.6,3.6,3.6C23.5,35.8,21.9,37.4,19.9,37.4z M90,0v48.9H78.6V2.4L90,0z M56.8,13.9c-9.7,0-17.6,7.9-17.6,17.7 c0,9.8,7.9,17.7,17.6,17.7c9.7,0,17.6-7.9,17.6-17.7C74.3,21.8,66.5,13.9,56.8,13.9z M56.8,37.4c-3.2,0-5.7-2.6-5.7-5.7 c0-3.2,2.5-5.7,5.7-5.7c3.2,0,5.7,2.6,5.7,5.7C62.5,34.8,59.9,37.4,56.8,37.4z M62.5,59.3c0,3.2-2.6,5.7-5.7,5.7 c-3.1,0-5.7-2.6-5.7-5.7c0-3.2,2.6-5.7,5.7-5.7C59.9,53.5,62.5,56.1,62.5,59.3z M111.8,14.5V26h-5.7v9c0,2.7,0.9,4.7,3.2,4.7 c0.9,0,1.7-0.1,2.5-0.3v8.5c-1.7,0.9-3.6,1.4-5.6,1.4h-0.1c-0.1,0-0.1,0-0.2,0c-0.1,0-0.1,0-0.2,0h-0.1l-0.2,0 C99.1,49,94.7,45,94.7,37.9v0v0V26V8.2l11.4-2.4v8.8H111.8z" />
                            </svg>
                          </div>
                          <span className="text-sm font-bold tracking-tight">Bolt</span>
                        </div>
                        {hasLocationAccess && cheapestFare && cheapestFare.provider === 'bolt' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                            {formatFare(cheapestFare.total)}
                          </span>
                        ) : (
                          <span className="text-[10px] opacity-70 font-medium">{t('bottomSheet.openApp', 'Open app')}</span>
                        )}
                      </button>

                      {/* Google Maps Button */}
                      <button
                        onClick={openGoogleMaps}
                        className={`w-full py-4 px-4 rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-[0.96] duration-300 backdrop-blur-3xl border shadow-lg ${isDark
                          ? 'bg-blue-600/10 border-blue-500/20 text-blue-400'
                          : 'bg-blue-50/60 border-blue-200 text-blue-800'
                          }`}
                      >
                        <div className="w-6 h-6 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-5 h-5">
                            <path fill="#4285F4" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                          </svg>
                        </div>
                        <span className="text-sm font-bold tracking-tight">{t('bottomSheet.openInGoogleMaps', 'Google Maps')}</span>
                      </button>

                      {/* Apple Maps Button */}
                      <button
                        onClick={openAppleMaps}
                        className={`w-full py-4 px-4 rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-[0.96] duration-300 backdrop-blur-3xl border shadow-lg ${isDark
                          ? 'bg-white/10 border-white/10 text-white'
                          : 'bg-gray-100/60 border-black/5 text-ios-gray-900'
                          }`}
                      >
                        <div className="w-6 h-6 flex items-center justify-center">
                          <svg viewBox="-1.5 0 20 20" className={`w-5 h-5 ${isDark ? 'fill-white' : 'fill-black'}`}>
                            <path d="M5.7 3.193c.73-.845 1.22-2.022 1.086-3.193-1.05.04-2.321.671-3.074 1.515-.676.749-1.267 1.946-1.108 3.094 1.17.087 2.366-.57 3.095-1.416m2.628 7.432c.03 3.027 2.77 4.034 2.801 4.047-.022.071-.438 1.435-1.444 2.845-.87 1.218-1.773 2.431-3.196 2.457-1.397.025-1.847-.794-3.446-.794-1.598 0-2.098.768-3.42 0.819-1.373 0.049-2.42-1.318-3.296-2.532-1.794-2.483-3.164-7.017-1.324-10.077.914-1.52 2.547-2.483 4.32-2.507 1.348-.025 2.621.869 3.445.869.824 0 2.375-1.075 4-0.917.68.027 2.59.264 3.818 1.985-.1.059-2.28 1.275-2.257 3.8z" />
                          </svg>
                        </div>
                        <span className="text-sm font-bold tracking-tight">{t('bottomSheet.openInAppleMaps', 'Apple Maps')}</span>
                      </button>
                    </div>

                    {/* Copy Coordinates */}
                    {office.latitude && office.longitude && (
                      <button
                        onClick={copyCoords}
                        className={`w-full group font-bold py-4 px-6 rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-[0.96] duration-300 backdrop-blur-3xl border shadow-lg ${isDark
                          ? 'bg-ios-gray-800/40 border-white/5 text-ios-gray-300'
                          : 'bg-white/60 border-black/5 text-ios-gray-600'
                          }`}
                      >
                        <svg className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <rect x="6" y="11" width="13" height="13" rx="3" />
                          <path d="M6 19C4.34 19 3 17.66 3 16V10C3 6.23 3 4.34 4.17 3.17C5.34 2 7.23 2 11 2H15C16.66 2 18 3.34 18 5" />
                        </svg>
                        <span className="text-sm">{t('bottomSheet.copyCoordinates', 'Copy Coordinates')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <div className={`sticky bottom-0 pt-4 pb-2 mt-6 border-t transition-colors duration-300 ${isDark
                  ? 'bg-card border-ios-gray-600'
                  : 'bg-background border-border'
                  }`}>
                  <button
                    onClick={onClose}
                    className={`w-full font-bold py-4 px-6 rounded-2xl transition-all active:scale-[0.98] duration-300 ${isDark
                      ? 'bg-ios-gray-800 hover:bg-ios-gray-700 text-white border border-white/5'
                      : 'bg-ios-gray-100 hover:bg-ios-gray-200 text-ios-gray-900 border border-black/5'
                      }`}
                  >
                    {t('common.close', 'Close')}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uber Modal - ALWAYS RENDERED BUT CONDITIONALLY SHOWN */}
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
