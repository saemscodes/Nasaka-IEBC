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
import {
  getOfficeDisplayName,
  getOfficeLandmark,
  getOfficeLandmarkDistance,
} from '@/utils/officeNameNormalizer';
import UberModal from './UberModal';
import OfflineRouteDownloader from './OfflineRouteDownloader';
import {
  MapPin,
  Navigation,
  Phone,
  Clock,
  Banknote,
  Cloud,
  CloudRain,
  Wind,
  AlertTriangle,
  ChevronRight,
  Info,
  Layers,
  Download,
  Wallet,
  Car,
  Bike,
  Sparkles,
  Users
} from 'lucide-react';
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
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold text-lg line-clamp-1 transition-colors duration-300 ${isDark ? 'text-white' : 'text-foreground'}`}>
                      {office.office_name || office.constituency_name || t('office.officeName', 'IEBC Office')}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 mt-1 overflow-x-auto no-scrollbar pb-1">
                    {(() => {
                      const dn = getOfficeDisplayName(office);
                      const cn = (office.constituency_name || '').toLowerCase();
                      return dn && dn.toLowerCase() !== cn && dn !== 'IEBC Office' ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <MapPin className={`w-3 h-3 ${isDark ? 'text-ios-blue-400' : 'text-primary'}`} />
                          <p className={`text-[11px] font-medium transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'}`}>
                            {dn}
                          </p>
                        </div>
                      ) : null;
                    })()}

                    {/* Weather & Traffic in Peek as requested */}
                    {hasLocationAccess && travelInsights && (
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1">
                          {travelInsights.weatherDesc?.toLowerCase().includes('rain') ? (
                            <CloudRain className="w-3 h-3 text-blue-400" />
                          ) : (
                            <Cloud className="w-3 h-3 text-ios-gray-400" />
                          )}
                          <span className="text-[11px] text-muted-foreground">{travelInsights.weatherDesc}</span>
                        </div>
                        {trafficInfo && (
                          <div className="flex items-center gap-1">
                            <Car className={`w-3 h-3 ${trafficInfo.color}`} />
                            <span className={`text-[11px] ${trafficInfo.color}`}>{trafficInfo.description}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p className={`text-xs mt-0.5 line-clamp-1 opacity-60 transition-colors duration-300 ${isDark ? 'text-ios-gray-300' : 'text-muted-foreground'}`}>
                    {office.constituency_name && office.county
                      ? `${office.constituency_name}, ${office.county}`
                      : office.county || office.constituency_name || t('office.location', 'Location')}
                  </p>
                </div>

                {/* Show distance and fare ONLY if we have location access */}
                {hasLocationAccess && distanceToOffice && (
                  <div className="ml-4 text-right shrink-0">
                    <div className="flex items-center justify-end gap-1">
                      <Navigation className={`w-3 h-3 ${isDark ? 'text-ios-blue-400' : 'text-primary'}`} />
                      <span className={`text-sm font-bold transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'}`}>
                        {distanceToOffice.toFixed(1)} km
                      </span>
                    </div>
                    {cheapestFare && (
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <Wallet className="w-3 h-3 text-green-500" />
                        <p className={`text-xs font-black transition-colors duration-300 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          {formatFare(cheapestFare.total)}
                        </p>
                      </div>
                    )}
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
                    {(() => {
                      const dn = getOfficeDisplayName(office);
                      const cn = (office.constituency_name || '').toLowerCase();
                      return dn && dn.toLowerCase() !== cn && dn !== 'IEBC Office' ? (
                        <p className={`text-sm font-medium mt-1 transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                          }`}>
                          📍 {dn}
                        </p>
                      ) : null;
                    })()}
                    {(() => {
                      const lm = getOfficeLandmark(office);
                      const dist = getOfficeLandmarkDistance(office);
                      return lm ? (
                        <div className="flex items-center gap-1.5 mt-1.5 opacity-70">
                          <MapPin className="w-3.5 h-3.5" />
                          <p className="text-xs font-semibold uppercase tracking-wider">
                            {t('office.nearLandmark', 'Near')}: <span className={isDark ? 'text-white' : 'text-black'}>{lm}</span>
                            {dist && dist !== 'On-site' ? (
                              <span className="ml-1 opacity-60"> — {dist} to IEBC Office</span>
                            ) : dist === 'On-site' ? ' — On-site' : ''}
                          </p>
                        </div>
                      ) : null;
                    })()}
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
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-xl ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                            <Banknote className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                          </div>
                          <div>
                            <h4 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                              {t('bottomSheet.estimatedRideCost', 'Estimated Ride Cost')}
                            </h4>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className={`text-xs font-bold leading-none flex items-center gap-1 ${trafficInfo?.color || 'text-gray-500'}`}>
                                {trafficInfo?.icon === 'sunrise' ? <Clock className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                                {trafficInfo?.description || t('bottomSheet.normalTraffic', 'Normal traffic')}
                              </span>
                              <div className="w-1 h-1 rounded-full bg-current opacity-30" />
                              <span className={`text-xs font-bold ${isDark ? 'text-ios-gray-400' : 'text-gray-600'}`}>
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
                              <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                                {t('bottomSheet.cheapestOption', 'Best Price')}
                              </p>
                              <div className="flex items-center gap-2">
                                {cheapestFare.icon === 'car' ? <Car className="w-5 h-5" /> :
                                  cheapestFare.icon === 'motorcycle' ? <Bike className="w-5 h-5" /> :
                                    cheapestFare.icon === 'sparkles' ? <Sparkles className="w-5 h-5" /> :
                                      <Users className="w-5 h-5" />}
                                <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {cheapestFare.displayName}
                                </p>
                              </div>
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
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                            <Navigation className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                          </div>
                          <div>
                            <h4 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-purple-300' : 'text-purple-800'}`}>
                              Travel Difficulty
                            </h4>
                            <p className={`text-xs font-bold mt-0.5 ${isDark ? 'text-ios-gray-400' : 'text-gray-600'}`}>
                              Real-time logic diagnostics
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
                      className={`w-full mb-6 font-bold min-h-[4.5rem] px-5 py-3 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98] duration-300 shadow-xl ${isDark
                        ? 'bg-ios-blue-600 text-white shadow-ios-blue/20 border border-white/10'
                        : 'bg-ios-blue text-white shadow-ios-blue/15 border border-black/5'
                        }`}
                    >
                      <span className="text-sm font-black leading-snug text-left pr-4">
                        {t('bottomSheet.moreOnOffice', {
                          officeName: office.office_name || getOfficeDisplayName(office) || office.constituency_name || t('office.officeName', 'IEBC Office'),
                          defaultValue: `More on {{officeName}}`
                        })}
                      </span>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-white/20' : 'bg-black/10'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>

                    <div className="grid gap-4 grid-cols-2">
                      {/* Uber Button - Mirroring Bolt Style as requested */}
                      <button
                        onClick={() => openUber()}
                        className={`group relative overflow-hidden w-full py-6 px-4 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.96] duration-500 shadow-2xl border ${isDark
                          ? 'bg-ios-gray-900/60 border-white/5 text-white hover:bg-ios-gray-800'
                          : 'bg-white border-black/5 text-ios-gray-900 hover:bg-gray-50'
                          }`}
                      >
                        <div className="h-6 w-full flex items-center justify-center pointer-events-none">
                          <img
                            src="/context/Button icons/Uber_logo_2018 (1).svg"
                            className={`h-full w-auto transition-transform duration-500 group-hover:scale-110 ${isDark ? 'invert' : ''}`}
                            alt="Uber"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                          <span className="font-black text-xl hidden">Uber</span>
                        </div>
                        {hasLocationAccess && fareEstimates && (
                          <div className={`mt-1 font-black text-xs px-3 py-1 rounded-full shadow-lg transition-colors duration-500 ${cheapestFare?.provider === 'uber'
                              ? 'bg-green-500 text-white'
                              : isDark ? 'bg-ios-gray-700 text-green-400' : 'bg-green-50 text-green-600'
                            }`}>
                            {(() => {
                              const uberFares = Object.values(fareEstimates.uber).map(f => f.total);
                              const minUber = Math.min(...uberFares);
                              return formatFare(minUber);
                            })()}
                          </div>
                        )}
                        {!hasLocationAccess && (
                          <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{t('bottomSheet.openApp', 'Open app')}</span>
                        )}
                      </button>

                      {/* Bolt Button */}
                      <button
                        onClick={openBolt}
                        className={`group relative overflow-hidden w-full py-6 px-4 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.96] duration-500 shadow-2xl border ${isDark
                          ? 'bg-green-600/10 border-green-500/20 text-green-400 hover:bg-green-600/15'
                          : 'bg-green-50/60 border-green-200 text-green-800 hover:bg-green-100/60'
                          }`}
                      >
                        <div className="h-6 w-full flex items-center justify-center pointer-events-none">
                          <img
                            src="/context/Button icons/Bolt_idw_2V0lyO_0.svg"
                            className="h-full w-auto transition-transform duration-500 group-hover:scale-110"
                            alt="Bolt"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                          <span className="font-black text-xl hidden text-green-600">Bolt</span>
                        </div>
                        {hasLocationAccess && fareEstimates && (
                          <div className={`mt-1 font-black text-xs px-3 py-1 rounded-full shadow-lg transition-colors duration-500 ${cheapestFare?.provider === 'bolt'
                              ? 'bg-green-600 text-white'
                              : isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-600 text-white'
                            }`}>
                            {(() => {
                              const boltFares = Object.values(fareEstimates.bolt).map(f => f.total);
                              const minBolt = Math.min(...boltFares);
                              return formatFare(minBolt);
                            })()}
                          </div>
                        )}
                      </button>

                      {/* Google Maps Button */}
                      <button
                        onClick={openGoogleMaps}
                        className={`w-full py-4 px-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.96] duration-300 backdrop-blur-3xl border shadow-xl ${isDark
                          ? 'bg-blue-600/10 border-blue-500/20 text-white hover:bg-blue-600/15'
                          : 'bg-blue-50/60 border-blue-200 text-blue-900 hover:bg-blue-100/60'
                          }`}
                      >
                        <Navigation className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        <span className="text-xs font-black uppercase tracking-tight">{t('bottomSheet.openInGoogleMaps', 'Google Maps')}</span>
                      </button>

                      {/* Apple Maps Button - Cleaned from hardcoded Bus info */}
                      <button
                        onClick={openAppleMaps}
                        className={`group relative overflow-hidden w-full py-4 px-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.96] duration-300 backdrop-blur-3xl border shadow-xl ${isDark
                          ? 'bg-ios-gray-900/60 border-white/10 text-white hover:bg-ios-gray-800'
                          : 'bg-white border-black/5 text-ios-gray-900 hover:bg-gray-50'
                          }`}
                      >
                        <div className="h-6 w-full flex items-center justify-center pointer-events-none mb-1">
                          <img
                            src="/context/Button icons/apple-173-svgrepo-com.svg"
                            className={`h-full w-auto ${isDark ? 'invert' : ''}`}
                            alt="Apple Maps"
                          />
                        </div>
                        <span className="text-xs font-black uppercase tracking-tight">Apple Maps</span>
                      </button>
                    </div>

                    {/* Copy Coordinates */}
                    {office.latitude && office.longitude && (
                      <button
                        onClick={copyCoords}
                        className={`w-full group font-bold py-4 px-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.96] duration-300 backdrop-blur-3xl border shadow-md hover:shadow-lg ${isDark
                          ? 'bg-ios-gray-800/40 border-white/5 text-ios-gray-300 hover:bg-ios-gray-800/60'
                          : 'bg-white/60 border-black/5 text-ios-gray-600 hover:bg-white/80'
                          }`}
                      >
                        <svg className="w-5 h-5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-all duration-300" viewBox="0 0 24 24" fill="none">
                          <path d="M15.24 2H11.3458C9.58159 1.99999 8.18418 1.99997 7.09054 2.1476C5.96501 2.29953 5.05402 2.61964 4.33559 3.34096C3.61717 4.06227 3.29833 4.97692 3.14701 6.10697C2.99997 7.205 2.99999 8.60802 3 10.3793V16.2169C3 17.725 3.91995 19.0174 5.22717 19.5592C5.15989 18.6498 5.15994 17.3737 5.16 16.312L5.16 11.3976L5.16 11.3024C5.15993 10.0207 5.15986 8.91644 5.27828 8.03211C5.40519 7.08438 5.69139 6.17592 6.4253 5.43906C7.15921 4.70219 8.06404 4.41485 9.00798 4.28743C9.88877 4.16854 10.9887 4.1686 12.2652 4.16867L12.36 4.16868H15.24L15.3348 4.16867C16.6113 4.1686 17.7088 4.16854 18.5896 4.28743C18.0627 2.94779 16.7616 2 15.24 2Z" fill="currentColor" />
                          <path d="M6.6001 11.3974C6.6001 8.67119 6.6001 7.3081 7.44363 6.46118C8.28716 5.61426 9.64481 5.61426 12.3601 5.61426H15.2401C17.9554 5.61426 19.313 5.61426 20.1566 6.46118C21.0001 7.3081 21.0001 8.6712 21.0001 11.3974V16.2167C21.0001 18.9429 21.0001 20.306 20.1566 21.1529C19.313 21.9998 17.9554 21.9998 15.2401 21.9998H12.3601C9.64481 21.9998 8.28716 21.9998 7.44363 21.1529C6.6001 20.306 6.6001 18.9429 6.6001 16.2167V11.3974Z" fill="currentColor" />
                        </svg>
                        <span className="text-sm">{t('bottomSheet.copyCoordinates', 'Copy Coordinates')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <div className={`sticky bottom-0 pt-4 pb-2 mt-6 border-t transition-colors duration-300 ${isDark
                  ? 'border-white/10'
                  : 'border-black/5'
                  }`}
                  style={{
                    background: isDark
                      ? 'rgba(15, 15, 25, 0.6)'
                      : 'rgba(255, 255, 255, 0.6)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  }}
                >
                  <button
                    onClick={onClose}
                    className={`w-full font-bold py-4 px-6 rounded-2xl transition-all active:scale-[0.98] duration-300 ${isDark
                      ? 'text-white border border-white/10 hover:border-white/20'
                      : 'text-ios-gray-900 border border-black/5 hover:border-black/10'
                      }`}
                    style={{
                      background: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.04)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      boxShadow: isDark
                        ? '0 -1px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                        : '0 -1px 12px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
                    }}
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
