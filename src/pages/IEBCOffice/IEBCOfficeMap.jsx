import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import MapContainer from '@/components/IEBCOffice/MapContainer';
import SearchBar from '@/components/IEBCOffice/SearchBar';
import GeoJSONLayerManager, { searchNearbyOffices } from '@/components/IEBCOffice/GeoJSONLayerManager';
import UserLocationMarker from '@/components/IEBCOffice/UserLocationMarker';
import RoutingSystem from '@/components/IEBCOffice/RoutingSystem';
import LayerControlPanel from '@/components/IEBCOffice/LayerControlPanel';
import OfficeBottomSheet from '@/components/IEBCOffice/OfficeBottomSheet';
import OfficeListPanel from '@/components/IEBCOffice/OfficeListPanel';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';
import ContributeLocationButton from '@/components/IEBCOffice/ContributeLocationButton';
import LanguageSwitcher from '@/components/LanguageSwitcher/LanguageSwitcher';
import { useIEBCOffices } from '@/hooks/useIEBCOffices';
import { useMapControls } from '@/hooks/useMapControls';
import { findNearestOffice, findNearestOffices } from '@/utils/geoUtils';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const IEBCOfficeMap = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const userLocation = state?.userLocation;
  const manualEntry = state?.manualEntry;
  const { t } = useTranslation('nasaka');

  // CRITICAL: Determine if we have location access
  const hasLocationAccess = !!userLocation;

  const { offices, loading, error, searchOffices, refetch } = useIEBCOffices();
  const {
    mapCenter,
    mapZoom,
    selectedOffice,
    isListPanelOpen,
    searchQuery,
    mapRef,
    flyToOffice,
    flyToLocation,
    setSelectedOffice,
    setSearchQuery,
    openListPanel,
    closeListPanel
  } = useMapControls();

  // Enhanced state management
  const [activeLayers, setActiveLayers] = useState(['iebc-offices']);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [nearbyOffices, setNearbyOffices] = useState([]);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [lastTapLocation, setLastTapLocation] = useState(null);
  const [routingError, setRoutingError] = useState(null);
  const [bottomSheetState, setBottomSheetState] = useState('peek');
  const [isPanelBackdropVisible, setIsPanelBackdropVisible] = useState(false);
  const [baseMap, setBaseMap] = useState('standard');
  const [searchResults, setSearchResults] = useState([]);
  const [accuracyCircle, setAccuracyCircle] = useState(null);
  const [routeBadgePosition, setRouteBadgePosition] = useState({ x: 20, y: 140 });
  const [isDraggingRouteBadge, setIsDraggingRouteBadge] = useState(false);
  const [urlQueryProcessed, setUrlQueryProcessed] = useState(false);

  const mapInstanceRef = useRef(null);
  const tileLayersRef = useRef({});
  const accuracyCircleRef = useRef(null);
  const routeBadgeRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const badgeStartPos = useRef({ x: 0, y: 0 });

  // Pull-to-refresh configuration
  const handleRefresh = useCallback(() => {
    console.log('Pull-to-refresh triggered - reloading page...');
    window.location.reload();
  }, []);

  // Initialize pull-to-refresh with map exclusion
  usePullToRefresh({
    onRefresh: handleRefresh,
    excludeSelectors: [
      '.map-wrapper',
      '.leaflet-container',
      '.ios-control-btn',
      '.search-container',
      '.office-bottom-sheet',
      '.office-list-panel',
      '.layer-control-panel',
      '.route-badge-draggable',
    ],
    enabled: true
  });

  // Handle URL query parameter on component mount
  useEffect(() => {
    const query = searchParams.get('q');
    if (query && !urlQueryProcessed && offices.length > 0 && mapInstanceRef.current) {
      handleUrlQuerySearch(query);
    }
  }, [searchParams, offices, urlQueryProcessed]);

  // Function to handle URL query parameter search
  const handleUrlQuerySearch = async (query) => {
    if (!query.trim()) return;

    try {
      // First try to find in existing offices
      const officeResults = searchOffices(query);
      if (officeResults.length > 0) {
        // Found office in database - select it
        handleOfficeSelect(officeResults[0]);
        setUrlQueryProcessed(true);
        return;
      }

      // If not found in database, geocode using Nominatim
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=1`
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const data = await response.json();
      
      if (data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        // Fly to the location
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lon], 15, { duration: 2 });
          
          // Create a temporary marker for the search result
          const marker = L.marker([lat, lon])
            .addTo(mapInstanceRef.current)
            .bindPopup(`
              <div class="p-2">
                <h3 class="font-semibold">${t('search.searchResult', 'Search Result')}</h3>
                <p class="text-sm">${result.display_name}</p>
                <p class="text-xs text-gray-500">${t('search.query', 'Query')}: "${query}"</p>
              </div>
            `)
            .openPopup();
          
          // Remove marker after 10 seconds
          setTimeout(() => {
            if (marker && mapInstanceRef.current) {
              mapInstanceRef.current.removeLayer(marker);
            }
          }, 10000);
        }
      }
      
      setUrlQueryProcessed(true);
    } catch (error) {
      console.error('URL query search error:', error);
      setUrlQueryProcessed(true);
    }
  };

  // Initialize map reference
  const handleMapReady = useCallback((map) => {
    mapInstanceRef.current = map;
    initializeTileLayers(map);
  }, []);

  // Initialize tile layers
  const initializeTileLayers = useCallback((map) => {
    // Standard OpenStreetMap
    tileLayersRef.current.standard = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }
    );

    // Satellite view
    tileLayersRef.current.satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
        maxZoom: 19
      }
    );

    // Add default base map
    tileLayersRef.current.standard.addTo(map);
  }, []);

  // Handle base map changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayersRef.current.standard) return;

    // Remove all tile layers
    Object.values(tileLayersRef.current).forEach(layer => {
      if (mapInstanceRef.current.hasLayer(layer)) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });

    // Add selected base map
    if (tileLayersRef.current[baseMap]) {
      tileLayersRef.current[baseMap].addTo(mapInstanceRef.current);
    }
  }, [baseMap]);

  // Set initial map center and create accuracy circle - ONLY IF WE HAVE LOCATION ACCESS
  useEffect(() => {
    if (hasLocationAccess && userLocation?.latitude && userLocation?.longitude) {
      flyToLocation(userLocation.latitude, userLocation.longitude, 14);
      
      // Create accuracy circle if accuracy data is available
      if (userLocation.accuracy && mapInstanceRef.current) {
        // Remove existing accuracy circle
        if (accuracyCircleRef.current) {
          mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
        }
        
        // Create new accuracy circle
        accuracyCircleRef.current = L.circle([userLocation.latitude, userLocation.longitude], {
          radius: userLocation.accuracy,
          color: '#007AFF',
          fillColor: '#007AFF',
          fillOpacity: 0.1,
          weight: 1,
          opacity: 0.6
        }).addTo(mapInstanceRef.current);
      }
    }

    // Cleanup function to remove accuracy circle
    return () => {
      if (accuracyCircleRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
      }
    };
  }, [hasLocationAccess, userLocation, flyToLocation]);

  // Enhanced office selection
  const handleOfficeSelect = useCallback(async (office) => {
    let enhancedOffice = office;
    
    if (office.id && (!office.constituency_name || !office.county)) {
      try {
        const { data: fullOffice, error } = await supabase
          .from('iebc_offices')
          .select('*')
          .eq('id', office.id)
          .single();
        
        if (!error && fullOffice) {
          enhancedOffice = fullOffice;
        }
      } catch (err) {
        console.error('Error fetching full office details:', err);
      }
    }
    
    setSelectedOffice(enhancedOffice);
    flyToOffice(enhancedOffice);
    closeListPanel();
    setBottomSheetState('peek');
    setRoutingError(null);
  }, [setSelectedOffice, flyToOffice, closeListPanel]);

  // Enhanced search handler
  const handleSearch = useCallback(async (result) => {
    if (result.searchQuery) {
      // Perform full search with the query using the correct function
      const results = searchOffices(result.searchQuery);
      setSearchResults(results);
      setNearbyOffices(results);
      openListPanel();
      setIsPanelBackdropVisible(true);
    } else if (result.latitude && result.longitude) {
      // Office object selected
      handleOfficeSelect(result);
    } else {
      // Other result type
      handleOfficeSelect(result);
    }
  }, [searchOffices, handleOfficeSelect, openListPanel]);

  // Double-tap handler for area search - ONLY IF WE HAVE LOCATION ACCESS
  const handleDoubleTap = useCallback(async (latlng) => {
    if (!hasLocationAccess) return; // Don't allow area search without location access
    
    setIsSearchingNearby(true);
    setLastTapLocation(latlng);
    
    try {
      const nearby = await searchNearbyOffices(latlng.lat, latlng.lng, 5000);
      setNearbyOffices(nearby);
      setSearchResults(nearby);
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([latlng.lat, latlng.lng], 14, {
          duration: 1
        });
      }
      
      openListPanel();
      setIsPanelBackdropVisible(true);
      
      setTimeout(() => {
        setLastTapLocation(null);
      }, 3000);
    } catch (error) {
      console.error('Error searching nearby offices:', error);
    } finally {
      setIsSearchingNearby(false);
    }
  }, [hasLocationAccess, openListPanel]);

  // Handle route found event - ONLY IF WE HAVE LOCATION ACCESS
  const handleRouteFound = useCallback((routes) => {
    setCurrentRoute(routes);
    setRoutingError(null);
  }, []);

  // Handle route error - ONLY IF WE HAVE LOCATION ACCESS
  const handleRouteError = useCallback((error) => {
    console.error('Routing error:', error);
    setRoutingError(error?.message || t('bottomSheet.routingError', 'Failed to calculate route'));
    setCurrentRoute(null);
  }, [t]);

  // Find nearest office - ONLY IF WE HAVE LOCATION ACCESS
  const nearestOffice = useMemo(() => {
    if (!hasLocationAccess || !userLocation?.latitude || !userLocation?.longitude || offices.length === 0) {
      return null;
    }
    return findNearestOffice(userLocation.latitude, userLocation.longitude, offices);
  }, [hasLocationAccess, userLocation, offices]);

  // Set nearest office as selected - ONLY IF WE HAVE LOCATION ACCESS
  useEffect(() => {
    if (nearestOffice && !selectedOffice && !manualEntry && hasLocationAccess) {
      setSelectedOffice(nearestOffice);
      setBottomSheetState('peek');
    }
  }, [nearestOffice, selectedOffice, manualEntry, hasLocationAccess, setSelectedOffice]);

  // Get offices for list panel
  const listPanelOffices = useMemo(() => {
    if (searchResults.length > 0) {
      return searchResults;
    }
    if (nearbyOffices.length > 0) {
      return nearbyOffices;
    }
    if (hasLocationAccess && userLocation?.latitude && userLocation?.longitude) {
      return findNearestOffices(
        userLocation.latitude,
        userLocation.longitude,
        offices,
        20
      );
    }
    return offices.slice(0, 20);
  }, [hasLocationAccess, searchResults, nearbyOffices, userLocation, offices]);

  // Toggle layer visibility
  const toggleLayer = useCallback((layerId) => {
    setActiveLayers(prev =>
      prev.includes(layerId)
        ? prev.filter(id => id !== layerId)
        : [...prev, layerId]
    );
  }, []);

  // Handle base map change
  const handleBaseMapChange = useCallback((mapId) => {
    setBaseMap(mapId);
  }, []);

  // Navigation handlers
  const handleBack = () => navigate(-1);
  const handleSearchFocus = () => {
    openListPanel();
    setIsPanelBackdropVisible(true);
  };
  
  const handleRetryLocation = () => navigate('/nasaka-iebc', { replace: true });

  const openLayerPanel = () => {
    setIsLayerPanelOpen(true);
    setIsPanelBackdropVisible(true);
  };
  
  const closeLayerPanel = () => {
    setIsLayerPanelOpen(false);
    setIsPanelBackdropVisible(false);
  };

  const handleCloseListPanel = () => {
    closeListPanel();
    setIsPanelBackdropVisible(false);
    setSearchResults([]);
  };

  const handleBackdropClick = () => {
    closeListPanel();
    closeLayerPanel();
    setIsPanelBackdropVisible(false);
    setSearchResults([]);
  };

  // Bottom sheet handlers
  const handleBottomSheetExpand = () => setBottomSheetState('expanded');
  const handleBottomSheetCollapse = () => setBottomSheetState('peek');
  const handleBottomSheetClose = () => {
    setBottomSheetState('hidden');
    setSelectedOffice(null);
  };

  // Clear routing error after delay
  useEffect(() => {
    if (routingError) {
      const timer = setTimeout(() => {
        setRoutingError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [routingError]);

  // Handle panel backdrop visibility
  useEffect(() => {
    if (!isListPanelOpen && !isLayerPanelOpen) {
      setIsPanelBackdropVisible(false);
    }
  }, [isListPanelOpen, isLayerPanelOpen]);

  // Handle contribution success
  const handleContributionSuccess = useCallback((result) => {
    console.log('Contribution submitted successfully:', result);
    // Refresh offices to include new contribution
    refetch();
  }, [refetch]);

  // Route badge drag handlers - ONLY IF WE HAVE LOCATION ACCESS
  const handleRouteBadgeMouseDown = useCallback((e) => {
    if (!hasLocationAccess) return; // Don't allow dragging without location access
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggingRouteBadge(true);
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    dragStartPos.current = {
      x: clientX,
      y: clientY
    };
    badgeStartPos.current = { ...routeBadgePosition };
    
    // Add event listeners for drag
    const handleMove = (moveEvent) => {
      if (!isDraggingRouteBadge) return;
      
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      
      const moveClientX = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0].clientX);
      const moveClientY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0].clientY);
      
      if (moveClientX && moveClientY) {
        const deltaX = moveClientX - dragStartPos.current.x;
        const deltaY = moveClientY - dragStartPos.current.y;
        
        setRouteBadgePosition({
          x: badgeStartPos.current.x + deltaX,
          y: badgeStartPos.current.y + deltaY
        });
      }
    };

    const handleUp = () => {
      setIsDraggingRouteBadge(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
  }, [hasLocationAccess, routeBadgePosition, isDraggingRouteBadge]);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      // Remove any lingering event listeners
      document.removeEventListener('mousemove', () => {});
      document.removeEventListener('mouseup', () => {});
      document.removeEventListener('touchmove', () => {});
      document.removeEventListener('touchend', () => {});
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <LoadingSpinner size="large" />
        <p className="text-muted-foreground mt-4">{t('common.loading', 'Loading IEBC offices...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">{t('common.error', 'Unable to Load Data')}</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-medium"
          >
            {t('common.retry', 'Try Again')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ios-map-container relative">
      {/* FIXED UI Controls - ALWAYS ON TOP */}
      <div className="fixed-search-container">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onFocus={handleSearchFocus}
          onSearch={handleSearch}
          onLocationSearch={handleRetryLocation}
          placeholder={t('search.placeholder', 'Search IEBC offices by county, constituency, or location...')}
        />
      </div>

      <div className="fixed-controls-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex flex-col space-y-3"
        >
          {/* Language Switcher - Map Variant (USES rounded-lg) */}
          <LanguageSwitcher variant="map" />

          {/* Contribute Location Button */}
          <ContributeLocationButton 
            userLocation={userLocation}
            onSuccess={handleContributionSuccess}
          />

          <button
            onClick={openLayerPanel}
            className="ios-control-btn"
            aria-label={t('layers.mapLayers', 'Map layers')}
            >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M2 12.0001L11.6422 16.8212C11.7734 16.8868 11.839 16.9196 11.9078 16.9325C11.9687 16.9439 12.0313 16.9439 12.0922 16.9325C12.161 16.9196 12.2266 16.8868 12.3578 16.8212L22 12.0001M2 17.0001L11.6422 21.8212C11.7734 21.8868 11.839 21.9196 11.9078 21.9325C11.9687 21.9439 12.0313 21.9439 12.0922 21.9325C12.161 21.9196 12.2266 21.8868 12.3578 21.8212L22 17.0001M2 7.00006L11.6422 2.17895C11.7734 2.11336 11.839 2.08056 11.9078 2.06766C11.9687 2.05622 12.0313 2.05622 12.0922 2.06766C12.161 2.08056 12.2266 2.11336 12.3578 2.17895L22 7.00006L12.3578 11.8212C12.2266 11.8868 12.161 11.9196 12.0922 11.9325C12.0313 11.9439 11.9687 11.9439 11.9078 11.9325C11.839 11.9196 11.7734 11.8868 11.6422 11.8212L2 7.00006Z"
                />
            </svg>
          </button>

          {!hasLocationAccess && (
            <button
              onClick={handleRetryLocation}
              className="ios-control-btn"
              aria-label={t('search.useCurrentLocation', 'Use my location')}
            >
              {/* REPLACED SVG WITH HOME ICON */}
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 12.2039C2 9.91549 2 8.77128 2.5192 7.82274C3.0384 6.87421 3.98695 6.28551 5.88403 5.10813L7.88403 3.86687C9.88939 2.62229 10.8921 2 12 2C13.1079 2 14.1106 2.62229 16.116 3.86687L18.116 5.10812C20.0131 6.28551 20.9616 6.87421 21.4808 7.82274C22 8.77128 22 9.91549 22 12.2039V13.725C22 17.6258 22 19.5763 20.8284 20.7881C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.7881C2 19.5763 2 17.6258 2 13.725V12.2039Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M9 16C9.85038 16.6303 10.8846 17 12 17C13.1154 17 14.1496 16.6303 15 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          <button
            onClick={handleSearchFocus}
            className="ios-control-btn"
            aria-label={t('officeList.showAllOffices', 'Show all offices')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </motion.div>
      </div>

      {/* Fixed Badge Container - For non-draggable badges */}
      <div className="fixed-badge-container">
        <AnimatePresence>
          {isSearchingNearby && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="search-indicator"
            >
              <div className="flex items-center space-x-2">
                <LoadingSpinner size="small" />
                <span className="text-sm font-medium">{t('search.searching', 'Searching nearby offices...')}</span>
              </div>
            </motion.div>
          )}

          {hasLocationAccess && routingError && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="error-notification"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm font-medium">{t('bottomSheet.routingUnavailable', 'Routing unavailable')}</span>
              </div>
              <p className="text-xs mt-1 opacity-90">{t('bottomSheet.tapForGoogleMaps', 'Tap office for Google Maps directions.')}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Draggable Route Badge - ONLY WITH LOCATION ACCESS */}
      <AnimatePresence>
        {hasLocationAccess && currentRoute && currentRoute.length > 0 && (
      <motion.div
        ref={routeBadgeRef}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          scale: isDraggingRouteBadge ? 1.05 : 1,
          x: routeBadgePosition.x,
          y: routeBadgePosition.y
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          type: "spring",
          stiffness: isDraggingRouteBadge ? 1000 : 500,
          damping: 30,
          mass: 1
        }}
        className={`route-badge-draggable ${isDraggingRouteBadge ? 'dragging' : ''}`}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          transform: `translate(${routeBadgePosition.x}px, ${routeBadgePosition.y}px)`,
          zIndex: 1000,
          cursor: isDraggingRouteBadge ? 'grabbing' : 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          touchAction: 'none'
        }}
        onMouseDown={handleRouteBadgeMouseDown}
        onTouchStart={handleRouteBadgeMouseDown}
        onClick={(e) => {
          // Only trigger click if not dragging (small movement threshold)
          if (!isDraggingRouteBadge && selectedOffice) {
            setBottomSheetState('expanded');
          }
        }}
        >
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">
            {t('bottomSheet.routesFound', { count: currentRoute.length })}
          </span>
        </div>
        {currentRoute[0] && (
          <div className="text-muted-foreground text-xs mt-1">
            {t('bottomSheet.bestRoute', {
            distance: (currentRoute[0].summary.totalDistance / 1000).toFixed(1),
            time: Math.round(currentRoute[0].summary.totalTime / 60)
          })}
          </div>
        )}
        {/* Drag handle indicator */}
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-gray-400 rounded-full opacity-60 transition-opacity duration-200 hover:opacity-80"></div>
      </motion.div>
    )}
      </AnimatePresence>
      
      {/* Map Container - Isolated */}
      <MapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full"
        onMapReady={handleMapReady}
        onDoubleTap={handleDoubleTap}
      >
        {/* User Location Marker with Accuracy Circle - ONLY WITH LOCATION ACCESS */}
        {hasLocationAccess && (
          <UserLocationMarker
            position={userLocation ? [userLocation.latitude, userLocation.longitude] : null}
            accuracy={userLocation?.accuracy}
          />
        )}

        {/* GeoJSON Layer Manager */}
        <GeoJSONLayerManager
          activeLayers={activeLayers}
          onOfficeSelect={handleOfficeSelect}
          selectedOffice={selectedOffice}
          onNearbyOfficesFound={setNearbyOffices}
          baseMap={baseMap}
          liveOffices={offices}
        />

        {/* Last Tap Location Indicator - ONLY WITH LOCATION ACCESS */}
        {hasLocationAccess && lastTapLocation && (
          <UserLocationMarker
            position={[lastTapLocation.lat, lastTapLocation.lng]}
            accuracy={100}
            color="#FF9500"
          />
        )}

        {/* Routing System - ONLY WITH LOCATION ACCESS */}
        {hasLocationAccess && userLocation && selectedOffice && (
          <RoutingSystem
            userLocation={userLocation}
            destination={selectedOffice}
            onRouteFound={handleRouteFound}
            onRouteError={handleRouteError}
            showAlternatives={false}
          />
        )}
      </MapContainer>

      {/* PANEL BACKDROP - CRITICAL FIX: BELOW CONTROLS, ABOVE MAP */}
      <AnimatePresence>
        {isPanelBackdropVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
            className="panel-backdrop visible"
          />
        )}
      </AnimatePresence>

      {/* Layer Control Panel */}
      <LayerControlPanel
        layers={activeLayers}
        onToggleLayer={toggleLayer}
        isOpen={isLayerPanelOpen}
        onClose={closeLayerPanel}
        userLocation={userLocation}
        baseMap={baseMap}
        onBaseMapChange={handleBaseMapChange}
      />

      {/* Office List Panel */}
      <AnimatePresence>
        {isListPanelOpen && (
          <OfficeListPanel
            offices={listPanelOffices}
            onSelectOffice={handleOfficeSelect}
            onClose={handleCloseListPanel}
            searchQuery={searchQuery}
            userLocation={userLocation}
            isSearching={isSearchingNearby}
          />
        )}
      </AnimatePresence>

      {/* Office Bottom Sheet - WITH LOCATION ACCESS PROP */}
      <OfficeBottomSheet
        office={selectedOffice || nearestOffice}
        userLocation={userLocation}
        onOfficeSelect={handleOfficeSelect}
        currentRoute={currentRoute}
        routingError={routingError}
        state={bottomSheetState}
        onExpand={handleBottomSheetExpand}
        onCollapse={handleBottomSheetCollapse}
        onClose={handleBottomSheetClose}
        hasLocationAccess={hasLocationAccess} // CRITICAL: Pass location access status
      />
    </div>
  );
};

export default IEBCOfficeMap;