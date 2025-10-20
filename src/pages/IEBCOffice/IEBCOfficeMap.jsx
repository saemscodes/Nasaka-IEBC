// src/pages/IEBCOffice/IEBCOfficeMap.jsx
import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useIEBCOffices } from '@/hooks/useIEBCOffices';
import { useMapControls } from '@/hooks/useMapControls';
import { findNearestOffice, findNearestOffices } from '@/utils/geoUtils';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';

const IEBCOfficeMap = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const userLocation = state?.userLocation;
  const manualEntry = state?.manualEntry;

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

  // NEW: Handle URL query parameter on component mount
  useEffect(() => {
    const query = searchParams.get('q');
    if (query && !urlQueryProcessed && offices.length > 0 && mapInstanceRef.current) {
      handleUrlQuerySearch(query);
    }
  }, [searchParams, offices, urlQueryProcessed]);

  // NEW: Function to handle URL query parameter search
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
                <h3 class="font-semibold">Search Result</h3>
                <p class="text-sm">${result.display_name}</p>
                <p class="text-xs text-gray-500">Query: "${query}"</p>
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

  // Set initial map center and create accuracy circle
  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
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
  }, [userLocation, flyToLocation]);

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
      // Perform full search with the query
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

  // Double-tap handler for area search
  const handleDoubleTap = useCallback(async (latlng) => {
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
  }, [openListPanel]);

  // Handle route found event
  const handleRouteFound = useCallback((routes) => {
    setCurrentRoute(routes);
    setRoutingError(null);
  }, []);

  // Handle route error
  const handleRouteError = useCallback((error) => {
    console.error('Routing error:', error);
    setRoutingError(error?.message || 'Failed to calculate route');
    setCurrentRoute(null);
  }, []);

  // Find nearest office
  const nearestOffice = useMemo(() => {
    if (userLocation?.latitude && userLocation?.longitude && offices.length > 0) {
      return findNearestOffice(userLocation.latitude, userLocation.longitude, offices);
    }
    return null;
  }, [userLocation, offices]);

  // Set nearest office as selected
  useEffect(() => {
    if (nearestOffice && !selectedOffice && !manualEntry) {
      setSelectedOffice(nearestOffice);
      setBottomSheetState('peek');
    }
  }, [nearestOffice, selectedOffice, manualEntry, setSelectedOffice]);

  // Get offices for list panel
  const listPanelOffices = useMemo(() => {
    if (searchResults.length > 0) {
      return searchResults;
    }
    if (nearbyOffices.length > 0) {
      return nearbyOffices;
    }
    if (userLocation?.latitude && userLocation?.longitude) {
      return findNearestOffices(
        userLocation.latitude,
        userLocation.longitude,
        offices,
        20
      );
    }
    return offices.slice(0, 20);
  }, [searchResults, nearbyOffices, userLocation, offices]);

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
    // This now only opens panel when called from search (on Enter)
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

  // Route badge drag handlers - FIXED IMPLEMENTATION
  const handleRouteBadgeMouseDown = useCallback((e) => {
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
  }, [routeBadgePosition, isDraggingRouteBadge]);

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
        <p className="text-muted-foreground mt-4">Loading IEBC offices...</p>
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
          <h2 className="text-xl font-semibold text-foreground mb-2">Unable to Load Data</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-medium"
          >
            Try Again
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
          placeholder="Search IEBC offices by county, constituency, or location..."
        />
      </div>

      <div className="fixed-controls-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex flex-col space-y-3"
        >
          {/* Contribute Location Button */}
          <ContributeLocationButton 
            userLocation={userLocation}
            onSuccess={handleContributionSuccess}
          />

          <button
            onClick={openLayerPanel}
            className="ios-control-btn"
            aria-label="Map layers"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </button>

          {!userLocation && (
            <button
              onClick={handleRetryLocation}
              className="ios-control-btn"
              aria-label="Use my location"
            >
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          <button
            onClick={handleSearchFocus}
            className="ios-control-btn"
            aria-label="Show all offices"
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
                <span className="text-sm font-medium">Searching nearby offices...</span>
              </div>
            </motion.div>
          )}

          {routingError && (
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
                <span className="text-sm font-medium">Routing unavailable</span>
              </div>
              <p className="text-xs mt-1 opacity-90">Tap office for Google Maps directions.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Draggable Route Badge - FIXED IMPLEMENTATION */}
      <AnimatePresence>
        {currentRoute && currentRoute.length > 0 && (
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
                {currentRoute.length} route{currentRoute.length > 1 ? 's' : ''} found
              </span>
            </div>
            {currentRoute[0] && (
              <div className="text-muted-foreground text-xs mt-1">
                Best: {(currentRoute[0].summary.totalDistance / 1000).toFixed(1)} km, {Math.round(currentRoute[0].summary.totalTime / 60)} min
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
        {/* User Location Marker with Accuracy Circle */}
        <UserLocationMarker
          position={userLocation ? [userLocation.latitude, userLocation.longitude] : null}
          accuracy={userLocation?.accuracy}
        />

        {/* GeoJSON Layer Manager - FIXED MARKER DISPLAY */}
        <GeoJSONLayerManager
          activeLayers={activeLayers}
          onOfficeSelect={handleOfficeSelect}
          selectedOffice={selectedOffice}
          onNearbyOfficesFound={setNearbyOffices}
          baseMap={baseMap}
          liveOffices={offices} // NEW: Pass live offices for real-time updates
        />

        {/* Last Tap Location Indicator */}
        {lastTapLocation && (
          <UserLocationMarker
            position={[lastTapLocation.lat, lastTapLocation.lng]}
            accuracy={100}
            color="#FF9500"
          />
        )}

        {/* Routing System */}
        {userLocation && selectedOffice && (
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

      {/* Office Bottom Sheet */}
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
      />
    </div>
  );
};

export default IEBCOfficeMap;
