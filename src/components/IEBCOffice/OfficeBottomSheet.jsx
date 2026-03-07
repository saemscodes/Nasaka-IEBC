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
import i18next from 'i18next';
import { useNavigate } from 'react-router-dom';
import { slugify } from '@/components/SEO/SEOHead';

// === INTERNAL SVG COMPONENTS ===
const IconSun = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 1V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 21V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.22 4.22L5.64 5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18.36 18.36L19.78 19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.22 19.78L5.64 18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18.36 5.64L19.78 4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconCar = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.1565 17.5878L19.2335 19.9572C19.4673 20.4716 19.1219 21.0581 18.572 21.1118C16.1438 21.3489 11.2334 21.6667 9.4 21.6667C7.56667 21.6667 2.65623 21.3489 0.228023 21.1118C-0.32185 21.0581 -0.667253 20.4716 -0.433519 19.9572L0.643492 17.5878" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M17.3333 13V17.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M1.46667 13V17.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3.73333 19C4.65381 19 5.4 18.2538 5.4 17.3333C5.4 16.4129 4.65381 15.6667 3.73333 15.6667C2.81286 15.6667 2.06667 16.4129 2.06667 17.3333C2.06667 18.2538 2.81286 19 3.73333 19Z" fill="currentColor" />
    <path d="M15.0667 19C15.9871 19 16.7333 18.2538 16.7333 17.3333C16.7333 16.4129 15.9871 15.6667 15.0667 15.6667C14.1462 15.6667 13.4 16.4129 13.4 17.3333C13.4 18.2538 14.1462 19 15.0667 19Z" fill="currentColor" />
    <path d="M16.5 9.77197L15.9189 6.86616C15.5492 5.01777 13.9181 3.66663 12.0287 3.66663H6.7712C4.88179 3.66663 3.25071 5.01777 2.88102 6.86616L2.29995 9.77197C2.0834 10.8547 2.50341 11.9701 3.38531 12.6559L4.44521 13.4795C5.02102 13.9271 5.73199 14.1666 6.46332 14.1666H12.3366C13.0679 14.1666 13.7789 13.9271 14.3547 13.4795L15.4146 12.6559C16.2965 11.9701 16.7165 10.8547 16.5 9.77197Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconPin = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 21C16 17 20 13.4183 20 9C20 4.58172 16.4183 1 12 1C7.58172 1 4 4.58172 4 9C4 13.4183 8 17 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 12C13.6569 12 15 10.6569 15 9C15 7.34315 13.6569 6 12 6C10.3431 6 9 7.34315 9 9C9 10.6569 10.3431 12 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconWallet = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 4H3C1.89543 4 1 4.89543 1 6V18C1 19.1046 1.89543 20 3 20H21C22.1046 20 23 19.1046 23 18V6C23 4.89543 22.1046 4 21 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 10H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconRain = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 13V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 13V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 16.58C21.21 15.65 22 14.18 22 12.5C22 9.46 19.54 7 16.5 7C16.38 7 16.26 7.01 16.14 7.02C15.6 4.72 13.51 3 11 3C8.11 3 5.31 5.16 4.3 7.82C2.41 8.5 1 10.34 1 12.5C1 15.26 3.24 17.5 6 17.5H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconCompass = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M16 8L14.5 14.5L8 16L9.5 9.5L16 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconWindy = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 10H8.5C10.433 10 12 11.567 12 13.5C12 15.433 10.433 17 8.5 17H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 14H14.5C16.433 14 18 15.567 18 17.5C18 19.433 16.433 21 14.5 21H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 6H16.5C18.433 6 20 7.567 20 9.5C20 11.433 18.433 13 16.5 13H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconPhone = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 16.92V19.92C22 20.4723 21.5523 20.92 21 20.92C11.61 20.92 4 13.31 4 3.92C4 3.36772 4.44772 2.92 5 2.92H8C8.55228 2.92 9 3.36772 9 3.92C9 5.31 9.22 6.66 9.64 7.93C9.77 8.35 9.67 8.81 9.35 9.13L7.54 10.94C8.75 13.13 10.74 15.12 12.93 16.33L14.74 14.52C15.06 14.2 15.52 14.1 15.94 14.23C17.21 14.65 18.57 14.87 19.96 14.87C20.5123 14.87 20.96 15.3177 20.96 15.87V18.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconBolt = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#34A851" stroke="#34A851" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconGoogleMaps = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 11.9556C2 8.47078 2 6.7284 2.67818 5.39739C3.27473 4.22661 4.22661 3.27473 5.39739 2.67818C6.7284 2 8.47078 2 11.9556 2H20.0444C23.5292 2 25.2716 2 26.6026 2.67818C27.7734 3.27473 28.7253 4.22661 29.3218 5.39739C30 6.7284 30 8.47078 30 11.9556V20.0444C30 23.5292 30 25.2716 29.3218 26.6026C28.7253 27.7734 27.7734 28.7253 26.6026 29.3218C25.2716 30 23.5292 30 20.0444 30H11.9556C8.47078 30 6.7284 30 5.39739 29.3218C4.22661 28.7253 3.27473 27.7734 2.67818 26.6026C2 25.2716 2 23.5292 2 20.0444V11.9556Z" fill="white" />
    <path d="M24 12.8116L23.9999 12.8541C23.9998 12.872 23.9996 12.8899 23.9994 12.9078C23.9998 12.9287 24 12.9498 24 12.971C24 16.3073 21.4007 19.2604 19.6614 21.2367C19.1567 21.8101 18.7244 22.3013 18.449 22.6957C17.4694 24.0986 16.9524 25.6184 16.8163 26.2029C16.8163 26.6431 16.4509 27 16 27C15.5491 27 15.1837 26.6431 15.1837 26.2029C15.0476 25.6184 14.5306 24.0986 13.551 22.6957C13.2756 22.3013 12.8433 21.8101 12.3386 21.2367C10.5993 19.2604 8 16.3073 8 12.971C8 12.9498 8.0002 12.9287 8.0006 12.9078C8.0002 12.8758 8 12.8437 8 12.8116C8 8.49736 11.5817 5 16 5C20.4183 5 24 8.49736 24 12.8116ZM16 15.6812C17.7132 15.6812 19.102 14.325 19.102 12.6522C19.102 10.9793 17.7132 9.62319 16 9.62319C14.2868 9.62319 12.898 10.9793 12.898 12.6522C12.898 14.325 14.2868 15.6812 16 15.6812Z" fill="#34A851" />
    <path d="M23.1054 9.21856C22.1258 7.37546 20.4161 5.96177 18.3504 5.34277L13.7559 10.5615C14.3208 9.98352 15.1174 9.62346 16.0002 9.62346C17.7134 9.62346 19.1022 10.9796 19.1022 12.6524C19.1022 13.3349 18.8711 13.9646 18.4811 14.4711L23.1054 9.21856Z" fill="#4285F5" />
    <path d="M12.4311 21.3425C12.4004 21.3076 12.3695 21.2725 12.3383 21.2371C11.1918 19.9344 9.67162 18.2073 8.76855 16.2257L13.5439 10.8018C13.1387 11.3136 12.8976 11.9556 12.8976 12.6526C12.8976 14.3254 14.2865 15.6816 15.9997 15.6816C16.8675 15.6816 17.6521 15.3336 18.2151 14.7727L12.4311 21.3425Z" fill="#F9BB0E" />
    <path d="M9.89288 7.76562C8.71207 9.12685 8 10.8881 8 12.8117C8 12.8438 8.0002 12.8759 8.0006 12.9079C8.0002 12.9288 8 12.9499 8 12.9711C8 14.1082 8.30196 15.2009 8.76889 16.2254L13.5362 10.8106L9.89288 7.76562Z" fill="#E74335" />
    <path d="M18.3499 5.34254C17.6068 5.11988 16.8176 5 15.9997 5C13.5514 5 11.36 6.07387 9.89258 7.76553L13.5359 10.8105L13.5438 10.8015C13.6101 10.7178 13.6807 10.6375 13.7554 10.5611L18.3499 5.34254Z" fill="#1A73E6" />
  </svg>
);

const IconAppleMaps = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.05 20.28C16.32 21.01 15.32 21.5 14.12 21.5H9.88C8.68 21.5 7.68 21.01 6.95 20.28C6.22 19.55 5.73 18.55 5.73 17.35V13.11C5.73 11.91 6.22 10.91 6.95 10.18C7.68 9.45 8.68 8.96 9.88 8.96H14.12C15.32 8.96 16.32 9.45 17.05 10.18C17.78 10.91 18.27 11.91 18.27 13.11V17.35C18.27 18.55 17.78 19.55 17.05 20.28Z" fill="#007AFF" />
    <path d="M12 17.5V13.5M10 15.5H14" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconUber = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const renderIcon = (icon, className = "w-4 h-4") => {
  if (typeof icon !== 'string') return icon;
  switch (icon) {
    case '🚗': return <IconCar className={className} />;
    case '⚡': return <IconBolt className={className} />;
    case '💰': return <IconWallet className={className} />;
    case '📍': return <IconPin className={className} />;
    case '📞': return <IconPhone className={className} />;
    case '☀️': return <IconSun className={className} />;
    case '🌧️': return <IconRain className={className} />;
    case '💨': return <IconWindy className={className} />;
    default: return <span>{icon}</span>;
  }
};

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
                  {(() => {
                    const dn = getOfficeDisplayName(office);
                    const cn = (office.constituency_name || '').toLowerCase();
                    return dn && dn.toLowerCase() !== cn && dn !== 'IEBC Office' ? (
                      <p className={`text-xs font-medium mt-0.5 line-clamp-1 transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                        }`}>
                        <IconPin className="w-3 h-3 inline-block mr-1" />
                        {dn}
                      </p>
                    ) : null;
                  })()}
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

              {/* QUICK GLANCE WEATHER/TRAFFIC (USER REQUEST) */}
              {hasLocationAccess && (travelInsights || trafficInfo) && (
                <div className={`mt-2 flex items-center space-x-3 px-1 animate-fade-in`}>
                  {travelInsights && (
                    <div className="flex items-center space-x-1">
                      <IconSun className="w-3.5 h-3.5" />
                      <span className={`text-[11px] font-bold ${isDark ? 'text-ios-gray-300' : 'text-gray-600'}`}>
                        {travelInsights.weatherDesc} • {travelInsights.temperature}°C
                      </span>
                    </div>
                  )}
                  {trafficInfo && (
                    <div className="flex items-center space-x-1">
                      <IconCar className="w-3.5 h-3.5" />
                      <span className={`text-[11px] font-bold ${trafficInfo.color || ''}`}>
                        {trafficInfo.description}
                      </span>
                    </div>
                  )}
                </div>
              )}
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
                          <IconPin className="w-4 h-4 inline-block mr-1" />
                          {dn}
                        </p>
                      ) : null;
                    })()}
                    {(() => {
                      const lm = getOfficeLandmark(office);
                      const dist = getOfficeLandmarkDistance(office);
                      return lm ? (
                        <p className={`text-xs mt-1 transition-colors duration-300 ${isDark ? 'text-ios-gray-400' : 'text-muted-foreground'
                          }`}>
                          <IconCompass className="w-4 h-4 inline-block mr-1" />
                          {t('office.nearLandmark', 'Near')}: {lm}{dist && dist !== 'On-site' ? ` (${dist})` : dist === 'On-site' ? ' — On-site' : ''}
                        </p>
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
                        <IconPin className="w-5 h-5 mt-0.5" />
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
                          <IconWallet className="w-5 h-5" />
                          <div>
                            <h4 className={`text-sm font-semibold ${isDark ? 'text-green-300' : 'text-green-800'
                              }`}>
                              {t('bottomSheet.estimatedRideCost', 'Estimated Ride Cost')}
                            </h4>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className={`text-xs ${trafficInfo?.color || 'text-gray-500'}`}>
                                {trafficInfo?.icon?.includes('sun') ? <IconSun className="w-4 h-4 inline-block mr-1" /> : (trafficInfo?.icon?.includes('cloud') ? <IconRain className="w-4 h-4 inline-block mr-1" /> : <IconCar className="w-4 h-4 inline-block mr-1" />)}
                                {trafficInfo?.description || t('bottomSheet.normalTraffic', 'Normal traffic')}
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
                                <IconSun className="w-3 h-3 inline-block mr-1" />
                                {t('bottomSheet.cheapestOption', 'Cheapest Option')}
                              </p>
                              <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                {renderIcon(cheapestFare.icon)} {cheapestFare.displayName}
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
                                          <span className="text-sm">{renderIcon(fare.icon)}</span>
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
                                            <span className="text-sm">{renderIcon(fare.icon)}</span>
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
                                <IconSun className="w-4 h-4 inline-block mr-1" />
                                {fareEstimates.traffic.description} - {t('bottomSheet.trafficSurchargeIncluded', 'Prices include traffic surcharge')}
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
                          <IconCompass className="w-5 h-5" />
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
                              <IconWindy className="w-4 h-4 inline-block mr-1" />
                              {travelInsights.windSpeed} km/h
                            </p>
                          )}
                          {travelInsights.precipProb !== null && travelInsights.precipProb > 0 && (
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                              <IconRain className="w-4 h-4 inline-block mr-1" />
                              {travelInsights.precipProb}% rain
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
                          <IconPin className="w-4 h-4 inline-block mr-1 opacity-70" />
                          {office.constituency_name}, {office.county}
                        </span>
                      </div>
                    )}
                    {office.phone && (
                      <div className="flex items-center text-sm">
                        <a href={`tel:${office.phone}`} className={`hover:underline ${isDark ? 'text-ios-blue-300' : 'text-blue-600'
                          }`}>
                          <IconPhone className="w-4 h-4 inline-block mr-1" />
                          {office.phone}
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
                  <div className="space-y-3 pt-2">
                    <h4
                      className={`text-center text-lg md:text-xl font-semibold mb-3 ${isDark ? 'text-ios-gray-200' : 'text-gray-900'
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
                      className={`w-full mb-4 font-semibold py-4 px-6 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 duration-300 shadow-lg ${isDark
                        ? 'bg-ios-blue-600 text-white shadow-ios-blue/30'
                        : 'bg-ios-blue text-white shadow-ios-blue/20'
                        }`}
                    >
                      <span>View Verified Office Records</span>
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>

                    <div className={`grid gap-3 ${hasLocationAccess ? 'grid-cols-2' : 'grid-cols-1'
                      }`}>
                      {/* Uber Button - Conditional behavior based on location access */}
                      <button
                        onClick={() => openUber()}
                        className={`w-full font-semibold py-3 px-4 rounded-2xl flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 duration-300 ${uberColors.bg} ${uberColors.text} ${uberColors.hover} ${uberColors.border} ${uberColors.shadow}`}
                      >
                        <div className="flex items-center space-x-2">
                          <IconCar className="w-5 h-5" />
                          <span className="text-sm font-medium">
                            {t('bottomSheet.bookWithUber', 'Uber')}
                          </span>
                        </div>
                        {hasLocationAccess && cheapestFare && cheapestFare.provider === 'uber' && (
                          <span className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-600'
                            }`}>
                            {formatFare(cheapestFare.total)}
                          </span>
                        )}
                        {!hasLocationAccess && (
                          <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            {t('bottomSheet.openApp', 'Open app')}
                          </span>
                        )}
                      </button>

                      {/* Bolt Button - Conditional behavior based on location access */}
                      <button
                        onClick={openBolt}
                        className={`w-full font-semibold py-3 px-4 rounded-2xl flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 duration-300 ${boltColors.bg}  ${boltColors.text} ${boltColors.hover} ${boltColors.border} ${boltColors.shadow}`}
                      >
                        <div className="flex items-center space-x-2">
                          <IconBolt className="w-5 h-5" />
                          <span className="text-sm font-medium">
                            {t('bottomSheet.bookWithBolt', 'Bolt')}
                          </span>
                        </div>
                        {hasLocationAccess && cheapestFare && cheapestFare.provider === 'bolt' && (
                          <span className="text-xs font-medium text-yellow-300">
                            {formatFare(cheapestFare.total)}
                          </span>
                        )}
                        {!hasLocationAccess && (
                          <span className="text-xs font-medium text-yellow-200">
                            {t('bottomSheet.openApp', 'Open app')}
                          </span>
                        )}
                      </button>

                      {/* Google Maps Button - ALWAYS AVAILABLE */}
                      <button
                        onClick={openGoogleMaps}
                        className={`w-full font-semibold py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 duration-300 ${googleColors.bg} ${googleColors.text} ${googleColors.hover} ${googleColors.border} ${googleColors.shadow}`}
                      >
                        <IconGoogleMaps className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          {t('bottomSheet.openInGoogleMaps', 'Google Maps')}
                        </span>
                      </button>

                      {/* Apple Maps Button - ALWAYS AVAILABLE */}
                      <button
                        onClick={openAppleMaps}
                        className={`w-full font-semibold py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 duration-300 ${appleColors.bg} ${appleColors.text} ${appleColors.hover} ${appleColors.border} ${appleColors.shadow}`}
                      >
                        <IconAppleMaps className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          {t('bottomSheet.openInAppleMaps', 'Apple Maps')}
                        </span>
                      </button>
                    </div>

                    {/* Copy Coordinates - ALWAYS AVAILABLE */}
                    {office.latitude && office.longitude && (
                      <button
                        onClick={copyCoords}
                        className={`w-full font-medium py-3 px-6 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 duration-300 ${isDark
                          ? 'bg-ios-gray-700 hover:bg-ios-gray-600 text-ios-gray-200'
                          : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                          }`}
                      >
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          focusable="false"
                        >
                          {/* Back sheet */}
                          <rect x="3.5" y="7.5" width="13" height="13" rx="2" ry="2" />
                          {/* Front sheet (slightly offset) */}
                          <rect x="7.5" y="3.5" width="13" height="13" rx="2" ry="2" />
                        </svg>

                        <span>{t('bottomSheet.copyCoordinates', 'Copy Coordinates')}</span>
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
                    className={`w-full font-medium py-3 px-6 rounded-2xl transition-all active:scale-95 duration-300 ${isDark
                      ? 'bg-ios-gray-700 hover:bg-ios-gray-600 text-ios-gray-200'
                      : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
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
