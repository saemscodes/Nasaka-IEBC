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
import i18next from 'i18next';
import { useNavigate } from 'react-router-dom';
import { slugify } from '@/components/SEO/SEOHead';

// Premium SVG Component: Uber Logo (2018)
const UberLogo = ({ className }) => (
  <svg viewBox="0 0 512 512" className={className} fill="currentColor">
    <path d="M119.8,303.6c17.6,0,31.3-13.6,31.3-33.8V191.3h19.1V318.6H151.3V306.8a45.9,45.9,0,0,1-33.6,14c-27.3,0-48.2-19.8-48.2-49.8V191.4H88.6v78.5c0,20.5,13.4,33.7,31.2,33.7m64.6-112.3h18.4v46.4a46.11,46.11,0,0,1,32.9-13.8,48.45,48.45,0,0,1,0,96.9A46.52,46.52,0,0,1,202.6,307v11.6H184.4V191.3Zm50,113.2a32.2,32.2,0,1,0-32-32.4v.2a32,32,0,0,0,31.8,32.2h.2M339.3,224c26.7,0,46.4,20.5,46.4,48.2v6H310.3A31.09,31.09,0,0,0,341,304.6c10.7,0,19.8-4.4,26.7-13.6l13.3,9.8c-9.3,12.4-23.1,19.8-40,19.8-27.8,0-49.3-20.7-49.3-48.4-.1-26.2,20.5-48.2,47.6-48.2m-28.8,39.6H367c-3.1-14.2-14.5-23.6-28.2-23.6-13.5,0-25,9.5-28.3,23.6m124.4-21.4c-12,0-20.7,9.3-20.7,23.6v52.7H395.8V225.8H414v11.5c4.5-7.5,12-12.2,22.2-12.2h6.4v17.1Z" />
  </svg>
);

// Premium SVG Component: Apple Logo [#173]
const AppleLogo = ({ className }) => (
  <svg viewBox="-1.5 0 20 20" className={className} fill="currentColor">
    <g transform="translate(-46, -7279)">
      <path d="M57.5708873,7282.19296 C58.2999598,7281.34797 58.7914012,7280.17098 58.6569121,7279 C57.6062792,7279.04 56.3352055,7279.67099 55.5818643,7280.51498 C54.905374,7281.26397 54.3148354,7282.46095 54.4735932,7283.60894 C55.6455696,7283.69593 56.8418148,7283.03894 57.5708873,7282.19296 M60.1989864,7289.62485 C60.2283111,7292.65181 62.9696641,7293.65879 63,7293.67179 C62.9777537,7293.74279 62.562152,7295.10677 61.5560117,7296.51675 C60.6853718,7297.73474 59.7823735,7298.94772 58.3596204,7298.97372 C56.9621472,7298.99872 56.5121648,7298.17973 54.9134635,7298.17973 C53.3157735,7298.17973 52.8162425,7298.94772 51.4935978,7298.99872 C50.1203933,7299.04772 49.0738052,7297.68074 48.197098,7296.46676 C46.4032359,7293.98379 45.0330649,7289.44985 46.8734421,7286.3899 C47.7875635,7284.87092 49.4206455,7283.90793 51.1942837,7283.88393 C52.5422083,7283.85893 53.8153044,7284.75292 54.6394294,7284.75292 C55.4635543,7284.75292 57.0106846,7283.67793 58.6366882,7283.83593 C59.3172232,7283.86293 61.2283842,7284.09893 62.4549652,7285.8199 C62.355868,7285.8789 60.1747177,7287.09489 60.1989864,7289.62485" />
    </g>
  </svg>
);

// Premium SVG Component: Copy Icon
const CopyIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none">
    <path d="M15.24 2H11.3458C9.58159 1.99999 8.18418 1.99997 7.09054 2.1476C5.96501 2.29953 5.05402 2.61964 4.33559 3.34096C3.61717 4.06227 3.29833 4.97692 3.14701 6.10697C2.99997 7.205 2.99999 8.60802 3 10.3793V16.2169C3 17.725 3.91995 19.0174 5.22717 19.5592C5.15989 18.6498 5.15994 17.3737 5.16 16.312L5.16 11.3976L5.16 11.3024C5.15993 10.0207 5.15986 8.91644 5.27828 8.03211C5.40519 7.08438 5.69139 6.17592 6.4253 5.43906C7.15921 4.70219 8.06404 4.41485 9.00798 4.28743C9.88877 4.16854 10.9887 4.1686 12.2652 4.16867L12.36 4.16868H15.24L15.3348 4.16867C16.6113 4.1686 17.7088 4.16854 18.5896 4.28743C18.0627 2.94779 16.7616 2 15.24 2Z" fill="currentColor" />
    <path d="M6.6001 11.3974C6.6001 8.67119 6.6001 7.3081 7.44363 6.46118C8.28716 5.61426 9.64481 5.61426 12.3601 5.61426H15.2401C17.9554 5.61426 19.313 5.61426 20.1566 6.46118C21.0001 7.3081 21.0001 8.6712 21.0001 11.3974V16.2167C21.0001 18.9429 21.0001 20.306 20.1566 21.1529C19.313 21.9998 17.9554 21.9998 15.2401 21.9998H12.3601C9.64481 21.9998 8.28716 21.9998 7.44363 21.1529C6.6001 20.306 6.6001 18.9429 6.6001 16.2167V11.3974Z" fill="currentColor" />
  </svg>
);

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
  const [showOfflineDownloader, setShowOfflineDownloader] = useState(false);
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
    if (e.target === backdropRef.current && state === 'expanded' && !showUberModal && !showOfflineDownloader) {
      onCollapse?.();
    }
  };

  // Handle escape key to minimize
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && state === 'expanded' && !showUberModal && !showOfflineDownloader) {
        onCollapse?.();
      }
    };
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [state, showUberModal, showOfflineDownloader, onCollapse]);

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

  return (
    <>
      {/* Backdrop for tapping outside - Only when expanded and no modal open */}
      <AnimatePresence>
        {state === 'expanded' && !showUberModal && !showOfflineDownloader && (
          <motion.div
            ref={backdropRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`office-bottom-sheet-backdrop active backdrop-blur-md transition-all duration-300 ${isDark ? 'bg-black/60' : 'bg-black/20'}`}
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
              ? 'bg-[#0A0A0F] border-white/10 text-white shadow-[0_-8px_40px_rgba(0,0,0,0.6)]'
              : 'bg-white border-ios-gray-200 text-ios-gray-900 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]'
              } rounded-t-[2.5rem] backdrop-blur-3xl overflow-hidden transition-colors duration-300`}
            style={{ y: dragY }}
          >
            {/* Drag Handle */}
            <div
              className={`w-12 h-1.5 mx-auto mt-3 rounded-full ${isDark ? 'bg-white/10' : 'bg-ios-gray-300'
                } transition-colors duration-300`}
              onPointerDown={e => dragControls.start(e)}
            />

            {/* Peek Preview */}
            <div className="px-6 py-4 cursor-pointer" onClick={handlePeekTap}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className={`font-bold text-xl tracking-tight transition-colors duration-300 ${isDark ? 'text-white' : 'text-ios-gray-900'
                    }`}>
                    {office.office_name || office.constituency_name || t('office.officeName', 'IEBC Office')}
                  </h3>
                  <p className={`text-sm font-medium mt-1 transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-[#007AFF]'
                    }`}>
                    📍 {office.constituency_name}, {office.county}
                  </p>
                </div>

                {/* Show distance and fare ONLY if we have location access */}
                {hasLocationAccess && distanceToOffice && (
                  <div className="ml-4 text-right">
                    <span className={`text-sm font-black transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-[#007AFF]'
                      }`}>
                      {t('office.distance', { distance: distanceToOffice.toFixed(1) })}
                    </span>
                    {cheapestFare && (
                      <p className={`text-xs mt-1 font-black transition-colors duration-300 ${isDark ? 'text-green-400' : 'text-green-600'
                        }`}>
                        {formatFare(cheapestFare.total)}
                      </p>
                    )}
                  </div>
                )}
                {!hasLocationAccess && (
                  <div className="ml-4 text-right">
                    <span className={`text-sm font-black transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-[#007AFF]'
                      }`}>
                      {t('office.tapForDirections', 'Tap for Directions')}
                    </span>
                    <p className={`text-xs mt-1 font-medium transition-colors duration-300 ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'
                      }`}>
                      {t('office.noLocationAccess', 'No Location Access')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {state === 'expanded' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="px-6 pb-10 space-y-6 overflow-y-auto max-h-[calc(85vh-80px)] premium-scrollbar"
              >
                {/* Header Info */}
                <div className={`pt-2 pb-6 border-b transition-colors duration-300 ${isDark ? 'border-white/5' : 'border-ios-gray-100'
                  }`}>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {office.office_type && (
                      <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${isDark
                        ? 'bg-ios-blue/10 text-ios-blue-400 border border-ios-blue/20'
                        : 'bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20'
                        }`}>
                        {office.office_type}
                      </span>
                    )}
                    <button
                      onClick={() => setShowOfflineDownloader(true)}
                      className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-2 ${isDark
                        ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                        : 'bg-ios-gray-100 text-ios-gray-900 border border-black/5 hover:bg-ios-gray-200'
                        } transition-all active:scale-[0.95]`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {t('bottomSheet.offlineMap', 'Trip Protection')}
                    </button>
                  </div>

                  {(() => {
                    const lm = getOfficeLandmark(office);
                    const dist = getOfficeLandmarkDistance(office);
                    return lm ? (
                      <div className={`p-4 rounded-2xl mb-4 flex items-center gap-3 ${isDark ? 'bg-white/5 border border-white/5' : 'bg-ios-gray-50 border border-ios-gray-100'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                          <span className="text-xl">📍</span>
                        </div>
                        <div>
                          <p className={`text-[11px] font-black uppercase tracking-tight ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                            {t('office.nearLandmark', 'Exact Location Landmark')}
                          </p>
                          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>
                            {lm} <span className={`ml-1 font-medium ${isDark ? 'text-ios-blue-400' : 'text-[#007AFF]'}`}>{dist}</span>
                          </p>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* LOCATION ACCESS WARNING */}
                {!hasLocationAccess && (
                  <div className={`rounded-[2rem] p-5 border transition-all duration-300 ${isDark
                    ? 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20'
                    : 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200'
                    }`}>
                    <div className="flex items-start space-x-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-yellow-500/20' : 'bg-white shadow-md'}`}>
                        <span className="text-2xl">⚠️</span>
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-base font-black tracking-tight mb-1 ${isDark ? 'text-yellow-400' : 'text-yellow-800'}`}>
                          {t('bottomSheet.locationAccessRequired', 'Location Access Required')}
                        </h4>
                        <p className={`text-xs font-medium leading-relaxed ${isDark ? 'text-ios-gray-400' : 'text-yellow-700/80'}`}>
                          {t('bottomSheet.locationAccessDesc', 'Enable location access to calculate real-time fares, travel difficulty, and precise directions from your current position.')}
                        </p>
                        <button
                          onClick={() => window.location.reload()}
                          className={`mt-4 w-full py-3 rounded-xl font-black text-sm transition-all active:scale-[0.98] ${isDark
                            ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-lg shadow-yellow-500/20'
                            : 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-lg shadow-yellow-500/15'
                            }`}
                        >
                          {t('bottomSheet.enableLocationAccess', 'Enable Access')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* FARE ESTIMATES CARD */}
                {hasLocationAccess && fareEstimates && (
                  <div className={`rounded-[2rem] p-6 border transition-all duration-300 ${isDark
                    ? 'bg-card border-white/5 shadow-2xl saturate-[1.1]'
                    : 'bg-ios-gray-50 border-ios-gray-100'
                    }`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-green-500/10' : 'bg-white shadow-sm'}`}>
                          <span className="text-xl">💰</span>
                        </div>
                        <div>
                          <h4 className={`text-sm font-black tracking-tight ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>
                            {t('bottomSheet.estimatedRideCost', 'Route Pricing')}
                          </h4>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span className={`text-[10px] font-bold ${trafficInfo?.color || 'text-gray-500'}`}>
                              {trafficInfo?.icon || '🚗'} {trafficInfo?.description || t('bottomSheet.normalTraffic', 'Normal traffic')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowFareDetails(!showFareDetails)}
                        className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all active:scale-[0.95] ${isDark
                          ? 'bg-white/5 text-ios-gray-400 hover:bg-white/10'
                          : 'bg-white text-ios-gray-600 border border-ios-gray-200 hover:bg-ios-gray-50 shadow-sm'
                          }`}
                      >
                        {showFareDetails ? t('bottomSheet.hide', 'Hide') : t('bottomSheet.details', 'Details')}
                      </button>
                    </div>

                    {cheapestFare && (
                      <div className={`rounded-3xl p-5 mb-4 ${isDark
                        ? 'bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20'
                        : 'bg-white border border-green-200 shadow-sm'
                        }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-[0.1em] mb-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                              {t('bottomSheet.cheapestOption', 'Best Value Option')}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{cheapestFare.icon}</span>
                              <p className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>
                                {cheapestFare.displayName}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-black ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                              {formatFare(cheapestFare.total)}
                            </p>
                            <p className={`text-[10px] font-bold ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                              ~{cheapestFare.estimatedMinutes} {t('bottomSheet.estimatedTime', 'min drive')}
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
                          className="space-y-4 mt-4"
                        >
                          {/* Uber Breakdown */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-2">
                              <p className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>Uber</p>
                              <UberLogo className={`h-3 w-auto ${isDark ? 'text-white/40' : 'text-black/30'}`} />
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {Object.entries(fareEstimates.uber).map(([key, fare]) => (
                                <div
                                  key={key}
                                  className={`p-4 rounded-2xl flex items-center justify-between transition-all ${isDark
                                    ? 'bg-white/5 border border-white/5'
                                    : 'bg-white border border-ios-gray-100 shadow-sm'
                                    }`}
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="text-2xl">{fare.icon}</span>
                                    <div>
                                      <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>
                                        {fare.displayName}
                                      </p>
                                      <p className={`text-[10px] font-bold ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                                        {fare.description}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className={`text-sm font-black ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                      {formatFare(fare.total)}
                                    </p>
                                    {fare.trafficSurcharge > 0 && (
                                      <p className={`text-[9px] font-black text-orange-500 uppercase tracking-tighter`}>
                                        +{formatFare(fare.trafficSurcharge)} Traffic
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Bolt Breakdown */}
                          {fareEstimates.bolt && (
                            <div className="space-y-2 mt-4">
                              <div className="flex items-center justify-between px-2">
                                <p className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>Bolt</p>
                                <svg viewBox="0 0 111.9 65" className={`h-3 w-auto ${isDark ? 'fill-white/40' : 'fill-black/30'}`}><path d="M30.4,23c4.4-7.1,2.2-16.4-4.8-20.8C23.2,0.8,20.5,0,17.7,0H0v48.9h19.9c8.3,0,15-6.8,15-15.1 C34.9,29.7,33.3,25.9,30.4,23z M11.4,11.5h6.3c2,0,3.6,1.6,3.6,3.6c0,2-1.6,3.6-3.6,3.6h-6.3V11.5z M19.9,37.4h-8.5v-7.2h8.5 c2,0,3.6,1.6,3.6,3.6C23.5,35.8,21.9,37.4,19.9,37.4z M90,0v48.9H78.6V2.4L90,0z M56.8,13.9c-9.7,0-17.6,7.9-17.6,17.7 c0,9.8,7.9,17.7,17.6,17.7c9.7,0,17.6-7.9,17.6-17.7C74.3,21.8,66.5,13.9,56.8,13.9z M56.8,37.4c-3.2,0-5.7-2.6-5.7-5.7 c0-3.2,2.5-5.7,5.7-5.7c3.2,0,5.7,2.6,5.7,5.7C62.5,34.8,59.9,37.4,56.8,37.4z M62.5,59.3c0,3.2-2.6,5.7-5.7,5.7 c-3.1,0-5.7-2.6-5.7-5.7c0-3.2,2.6-5.7,5.7-5.7C59.9,53.5,62.5,56.1,62.5,59.3z M111.8,14.5V26h-5.7v9c0,2.7,0.9,4.7,3.2,4.7 c0.9,0,1.7-0.1,2.5-0.3v8.5c-1.7,0.9-3.6,1.4-5.6,1.4h-0.1c-0.1,0-0.1,0-0.2,0c-0.1,0-0.1,0-0.2,0h-0.1l-0.2,0 C99.1,49,94.7,45,94.7,37.9v0v0V26V8.2l11.4-2.4v8.8H111.8z" /></svg>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {Object.entries(fareEstimates.bolt).map(([key, fare]) => (
                                  <div
                                    key={key}
                                    className={`p-4 rounded-2xl flex items-center justify-between transition-all ${isDark
                                      ? 'bg-white/5 border border-white/5'
                                      : 'bg-white border border-ios-gray-100 shadow-sm'
                                      }`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <span className="text-2xl">{fare.icon}</span>
                                      <div>
                                        <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>
                                          {fare.displayName}
                                        </p>
                                        <p className={`text-[10px] font-bold ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                                          {fare.description}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-black ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                        {formatFare(fare.total)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p className={`text-[10px] mt-4 font-bold italic opacity-60 leading-relaxed ${isDark ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>
                      {FARE_DISCLAIMER.en}
                    </p>
                  </div>
                )}

                {/* TRAVEL DIFFICULTY CARD */}
                {travelInsights && (
                  <div className={`rounded-[2rem] p-6 border transition-all duration-300 ${isDark
                    ? 'bg-gradient-to-br from-[#12121A] to-[#0A0A0F] border-white/5 shadow-inner shadow-white/5'
                    : 'bg-white border-ios-gray-100 shadow-sm'
                    }`}>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDark ? 'bg-ios-blue/10' : 'bg-ios-blue-50'}`}>
                          <span className="text-xl">🧭</span>
                        </div>
                        <div>
                          <h4 className={`text-sm font-black tracking-tight ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>
                            Travel Difficulty
                          </h4>
                          <p className={`text-[10px] font-bold ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                            Real-time condition analysis
                          </p>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-2xl text-lg font-black ${travelInsights.severity === 'low'
                        ? isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'
                        : travelInsights.severity === 'medium'
                          ? isDark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-700'
                          : isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-700'
                        } border ${travelInsights.severity === 'low' ? 'border-green-500/20' : travelInsights.severity === 'medium' ? 'border-orange-500/20' : 'border-red-500/20'}`}>
                        {travelInsights.score}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className={`p-4 rounded-3xl ${isDark ? 'bg-white/5' : 'bg-ios-gray-50 border border-black/5'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                          Weather
                        </p>
                        <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>
                          {travelInsights.weatherDesc}
                        </p>
                        {travelInsights.temperature !== null && (
                          <p className={`text-xs font-black mt-1 ${isDark ? 'text-ios-blue-400' : 'text-[#007AFF]'}`}>
                            {travelInsights.temperature}°C
                          </p>
                        )}
                      </div>
                      <div className={`p-4 rounded-3xl ${isDark ? 'bg-white/5' : 'bg-ios-gray-50 border border-black/5'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>
                          Conditions
                        </p>
                        <div className="flex flex-col gap-1 mt-1">
                          <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>
                            💨 {travelInsights.windSpeed} km/h
                          </p>
                          {travelInsights.precipProb !== null && travelInsights.precipProb > 0 && (
                            <p className={`text-xs font-black text-ios-blue-400`}>
                              🌧️ {travelInsights.precipProb}% Rain
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 rounded-2xl bg-black/10 border border-white/5">
                      <p className={`text-[10px] font-bold leading-relaxed ${isDark ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>
                        Score Basis: Distance ({distanceToOffice?.toFixed(1)}km), Time ({fareEstimates?.estimatedMinutes}min), Traffic ({trafficInfo?.description}), and Weather intensity.
                      </p>
                    </div>
                  </div>
                )}

                {/* GET THERE SECTION */}
                <div className="pt-6 space-y-5">
                  <h4 className={`text-center text-[10px] font-black tracking-[0.4em] uppercase ${isDark ? 'text-ios-gray-700' : 'text-ios-gray-400'}`}>
                    Launch Navigation
                  </h4>

                  {/* High Priority: More on Office */}
                  <button
                    onClick={() => {
                      const countySlug = slugify(office.county);
                      let areaSlug = slugify(office.constituency_name || '');
                      if (areaSlug === countySlug) areaSlug = `${areaSlug}-town`;
                      navigate(`/${countySlug}/${areaSlug}`);
                    }}
                    className={`w-full group min-h-[5.5rem] px-8 py-5 rounded-[2.5rem] flex items-center justify-between transition-all active:scale-[0.98] duration-300 shadow-2xl ${isDark
                      ? 'bg-[#007AFF] text-white shadow-[#007AFF]/30 border border-white/10'
                      : 'bg-[#007AFF] text-white shadow-[#007AFF]/20'
                      }`}
                  >
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Official Records</p>
                      <span className="text-lg font-black tracking-tight leading-tight block">
                        Full Data on {office.office_name || getOfficeDisplayName(office) || office.constituency_name}
                      </span>
                    </div>
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 bg-white/20 backdrop-blur-xl border border-white/20 group-hover:scale-110 transition-all`}>
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>

                  {/* App Selection Grid */}
                  <div className={`grid gap-4 ${hasLocationAccess ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {/* Uber Button */}
                    <button
                      onClick={() => openUber()}
                      className={`group w-full py-8 px-5 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all active:scale-[0.96] duration-500 border-2 ${isDark
                        ? 'bg-[#050505] border-white/5 hover:border-white/10 text-white'
                        : 'bg-white border-ios-gray-100 hover:bg-ios-gray-50 text-ios-gray-900 shadow-xl'
                        }`}
                    >
                      <UberLogo className="h-7 w-auto" />
                      <div className="text-center group-hover:translate-y-[-2px] transition-transform">
                        <p className="text-[12px] font-black tracking-tighter uppercase">Request Ride</p>
                        {hasLocationAccess && cheapestFare && cheapestFare.provider === 'uber' ? (
                          <p className={`text-[10px] font-bold mt-1 px-3 py-1 rounded-full bg-green-500/10 text-green-400`}>
                            {formatFare(cheapestFare.total)}
                          </p>
                        ) : (
                          <p className="text-[10px] font-black opacity-30 tracking-[0.2em] mt-1">UBER APP</p>
                        )}
                      </div>
                    </button>

                    {/* Bolt Button */}
                    <button
                      onClick={openBolt}
                      className={`group w-full py-8 px-5 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all active:scale-[0.96] duration-500 border-2 ${isDark
                        ? 'bg-green-600/5 border-green-500/10 hover:border-green-500/20 text-green-400'
                        : 'bg-green-50/30 border-green-200 hover:bg-green-50 text-green-700 shadow-lg'
                        }`}
                    >
                      <div className="h-7 w-auto flex items-center justify-center">
                        <svg viewBox="0 0 111.9 65" className="h-full w-auto fill-current"><path d="M30.4,23c4.4-7.1,2.2-16.4-4.8-20.8C23.2,0.8,20.5,0,17.7,0H0v48.9h19.9c8.3,0,15-6.8,15-15.1 C34.9,29.7,33.3,25.9,30.4,23z M11.4,11.5h6.3c2,0,3.6,1.6,3.6,3.6c0,2-1.6,3.6-3.6,3.6h-6.3V11.5z M19.9,37.4h-8.5v-7.2h8.5 c2,0,3.6,1.6,3.6,3.6C23.5,35.8,21.9,37.4,19.9,37.4z M90,0v48.9H78.6V2.4L90,0z M56.8,13.9c-9.7,0-17.6,7.9-17.6,17.7 c0,9.8,7.9,17.7,17.6,17.7c9.7,0,17.6-7.9,17.6-17.7C74.3,21.8,66.5,13.9,56.8,13.9z M56.8,37.4c-3.2,0-5.7-2.6-5.7-5.7 c0-3.2,2.5-5.7,5.7-5.7c3.2,0,5.7,2.6,5.7,5.7C62.5,34.8,59.9,37.4,56.8,37.4z M62.5,59.3c0,3.2-2.6,5.7-5.7,5.7 c-3.1,0-5.7-2.6-5.7-5.7c0-3.2,2.6-5.7,5.7-5.7C59.9,53.5,62.5,56.1,62.5,59.3z M111.8,14.5V26h-5.7v9c0,2.7,0.9,4.7,3.2,4.7 c0.9,0,1.7-0.1,2.5-0.3v8.5c-1.7,0.9-3.6,1.4-5.6,1.4h-0.1c-0.1,0-0.1,0-0.2,0c-0.1,0-0.1,0-0.2,0h-0.1l-0.2,0 C99.1,49,94.7,45,94.7,37.9v0v0V26V8.2l11.4-2.4v8.8H111.8z" /></svg>
                      </div>
                      <div className="text-center group-hover:translate-y-[-2px] transition-transform">
                        <p className="text-[12px] font-black tracking-tighter uppercase">Bolt Economy</p>
                        {hasLocationAccess && cheapestFare && cheapestFare.provider === 'bolt' ? (
                          <p className={`text-[10px] font-bold mt-1 px-3 py-1 rounded-full bg-green-500/10 text-green-400`}>
                            {formatFare(cheapestFare.total)}
                          </p>
                        ) : (
                          <p className="text-[10px] font-black opacity-30 tracking-[0.2em] mt-1">BOLT APP</p>
                        )}
                      </div>
                    </button>

                    {/* Google Maps Button */}
                    <button
                      onClick={openGoogleMaps}
                      className={`w-full py-8 px-5 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all active:scale-[0.96] duration-500 border-2 ${isDark
                        ? 'bg-blue-600/5 border-blue-500/10 hover:border-blue-500/20 text-blue-400'
                        : 'bg-blue-50/30 border-blue-200 hover:bg-blue-100 text-blue-800 shadow-lg'
                        }`}
                    >
                      <div className="h-7 w-auto flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="h-full w-auto"><path fill="#4285F4" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" /></svg>
                      </div>
                      <p className="text-[12px] font-black tracking-[0.1em] uppercase">Google Maps</p>
                    </button>

                    {/* Apple Maps Button */}
                    <button
                      onClick={openAppleMaps}
                      className={`w-full py-8 px-5 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all active:scale-[0.96] duration-500 border-2 ${isDark
                        ? 'bg-[#15151A] border-white/5 hover:border-white/15 text-white shadow-inner'
                        : 'bg-white border-ios-gray-100 hover:bg-ios-gray-50 text-ios-gray-900 shadow-md'
                        }`}
                    >
                      <AppleLogo className="h-7 w-auto" />
                      <div className="text-center">
                        <p className="text-[12px] font-black tracking-[0.1em] uppercase">Apple Maps</p>
                        {hasLocationAccess && fareEstimates && (
                          <p className={`text-[10px] font-bold mt-1 text-ios-blue-400`}>
                            Live Pricing In-App
                          </p>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={copyCoords}
                    className={`w-full py-6 px-8 rounded-[2.5rem] flex items-center justify-center gap-4 transition-all active:scale-[0.98] border-2 ${isDark
                      ? 'bg-white/5 border-white/5 text-ios-gray-400 hover:text-white hover:bg-white/10'
                      : 'bg-ios-gray-50 border-black/5 text-ios-gray-500 hover:bg-ios-gray-100 shadow-sm'
                      }`}
                  >
                    <CopyIcon className="w-6 h-6 flex-shrink-0 opacity-60" />
                    <span className="text-sm font-black uppercase tracking-[0.3em]">{t('bottomSheet.copyCoordinates', 'Copy GPS Coordinates')}</span>
                  </button>
                </div>

                {/* Main Dismiss Button */}
                <button
                  onClick={onClose}
                  className={`w-full font-black py-6 px-10 rounded-[2.5rem] tracking-[0.4em] uppercase text-[10px] transition-all active:scale-[0.98] duration-400 ${isDark
                    ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                    : 'bg-black text-white hover:bg-ios-gray-900 shadow-2xl shadow-black/20'
                    }`}
                >
                  {t('common.close', 'Dismiss View')}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebars and Modals */}
      <UberModal
        isOpen={showUberModal}
        onClose={() => setShowUberModal(false)}
        onProductSelect={(product) => openUber(product.productType)}
        pickup={pickup}
        destination={destination}
        fareEstimates={fareEstimates}
      />

      <AnimatePresence>
        {showOfflineDownloader && (
          <OfflineRouteDownloader
            office={office}
            userLocation={userLocation}
            currentRoute={currentRoute}
            onClose={() => setShowOfflineDownloader(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default OfficeBottomSheet;
