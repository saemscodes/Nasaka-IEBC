// src/pages/IEBCOffice/IEBCOfficeMap.jsx
import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { useIEBCOffices } from '@/hooks/useIEBCOffices';
import { useMapControls } from '@/hooks/useMapControls';
import { findNearestOffice, findNearestOffices } from '@/utils/geoUtils';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';

const IEBCOfficeMap = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const userLocation = state?.userLocation;
  const manualEntry = state?.manualEntry;

  const { offices, loading, error, searchOffices } = useIEBCOffices();
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

  const mapInstanceRef = useRef(null);
  const tileLayersRef = useRef({});

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

  // Set initial map center
  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      flyToLocation(userLocation.latitude, userLocation.longitude, 14);
    }
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

          {currentRoute && currentRoute.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="route-badge cursor-pointer"
              onClick={() => {
                if (selectedOffice) {
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

      {/* Map Container - Isolated */}
      <MapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full"
        onMapReady={handleMapReady}
        onDoubleTap={handleDoubleTap}
      >
        {/* User Location Marker */}
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
