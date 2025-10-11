// src/pages/IEBCOffice/IEBCOfficeMap.jsx
import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MapContainer from '@/components/IEBCOffice/MapContainer';
import SearchBar from '@/components/IEBCOffice/SearchBar';
import GeoJSONLayerManager, { searchNearbyOffices } from '@/components/IEBCOffice/GeoJSONLayerManager';
import MapControlPortal from '@/components/IEBCOffice/MapControlPortal';
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
  const mapInstanceRef = useRef(null);

  // Initialize map reference
  const handleMapReady = useCallback((map) => {
    mapInstanceRef.current = map;
  }, []);

  // Set initial map center
  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      flyToLocation(userLocation.latitude, userLocation.longitude, 14);
    }
  }, [userLocation, flyToLocation]);

  // Enhanced office selection with Supabase data
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
    setRoutingError(null); // Clear previous routing errors
  }, [setSelectedOffice, flyToOffice, closeListPanel]);

  // Enhanced search with Supabase integration
  const handleSearch = useCallback((result) => {
    if (result.searchQuery) {
      const filtered = searchOffices(result.searchQuery);
      setNearbyOffices(filtered);
      openListPanel();
    } else if (result.latitude && result.longitude) {
      handleOfficeSelect(result);
    } else {
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
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([latlng.lat, latlng.lng], 14, {
          duration: 1
        });
      }
      
      openListPanel();
      
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
    console.log('Route calculation successful:', routes?.length, 'routes found');
  }, []);

  // Handle route error
  const handleRouteError = useCallback((error) => {
    console.error('Routing error:', error);
    setRoutingError(error?.message || 'Failed to calculate route');
    setCurrentRoute(null);
    
    // Show user-friendly error message
    if (error && selectedOffice) {
      console.warn('Routing failed, user can use Google Maps fallback');
    }
  }, [selectedOffice]);

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
    }
  }, [nearestOffice, selectedOffice, manualEntry, setSelectedOffice]);

  // Filter offices based on search query
  const filteredOffices = useMemo(() => {
    if (searchQuery.trim()) {
      return searchOffices(searchQuery);
    }
    return offices;
  }, [offices, searchQuery, searchOffices]);

  // Get nearby offices for the list panel
  const defaultNearbyOffices = useMemo(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      return findNearestOffices(userLocation.latitude, userLocation.longitude, offices, 20);
    }
    return offices.slice(0, 20);
  }, [userLocation, offices]);

  // Toggle layer visibility
  const toggleLayer = useCallback((layerId) => {
    setActiveLayers(prev => 
      prev.includes(layerId) 
        ? prev.filter(id => id !== layerId)
        : [...prev, layerId]
    );
  }, []);

  // Navigation handlers
  const handleBack = () => navigate(-1);
  const handleSearchFocus = () => openListPanel();
  const handleRetryLocation = () => navigate('/nasaka-iebc', { replace: true });
  const openLayerPanel = () => setIsLayerPanelOpen(true);
  const closeLayerPanel = () => setIsLayerPanelOpen(false);

  // Clear routing error after delay
  useEffect(() => {
    if (routingError) {
      const timer = setTimeout(() => {
        setRoutingError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [routingError]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-ios-bg">
        <LoadingSpinner size="large" />
        <p className="text-ios-gray-600 mt-4">Loading IEBC offices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-ios-bg px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-ios-red/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-ios-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-ios-gray-900 mb-2">Unable to Load Data</h2>
          <p className="text-ios-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-ios-blue text-white px-6 py-3 rounded-2xl font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ios-map-container">
      {/* Enhanced Map Container with iOS Design */}
      <div className="map-wrapper">
        <MapContainer
          ref={mapRef}
          center={mapCenter}
          zoom={mapZoom}
          className="h-full w-full"
          onMapReady={handleMapReady}
          onDoubleTap={handleDoubleTap}
          showLayerControl={true}
        >
          {/* UI Controls rendered into custom Leaflet pane */}
          <MapControlPortal zIndex={650} className="map-ui-overlay">
            {/* Enhanced Sticky Search Bar */}
            <div className="search-container">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onFocus={handleSearchFocus}
                onSearch={handleSearch}
                onLocationSearch={handleRetryLocation}
                placeholder="Search IEBC offices by county, constituency, or location..."
              />
            </div>

            {/* Control Buttons - iOS Style */}
            <motion.div
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="control-group"
            >
              {/* Layer Control Button */}
              <button
                onClick={openLayerPanel}
                className="ios-control-btn"
                aria-label="Map layers"
              >
                <svg className="w-5 h-5 text-ios-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </button>

              {/* Location Button */}
              {!userLocation && (
                <button
                  onClick={handleRetryLocation}
                  className="ios-control-btn"
                  aria-label="Use my location"
                >
                  <svg className="w-5 h-5 text-ios-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}

              {/* List Panel Button */}
              <button
                onClick={openListPanel}
                className="ios-control-btn"
                aria-label="Show all offices"
              >
                <svg className="w-5 h-5 text-ios-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </motion.div>

            {/* Double-tap Search Indicator */}
            {isSearchingNearby && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="search-indicator"
              >
                <div className="bg-ios-blue/90 text-white px-4 py-2 rounded-2xl shadow-lg">
                  <div className="flex items-center space-x-2">
                    <LoadingSpinner size="small" />
                    <span className="text-sm font-medium">Searching nearby offices...</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Route Information Badge */}
            {currentRoute && currentRoute.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="route-badge"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-ios-green rounded-full animate-pulse"></div>
                  <span className="text-ios-gray-900 text-sm font-medium">
                    {currentRoute.length} route{currentRoute.length > 1 ? 's' : ''} found
                  </span>
                </div>
                {currentRoute[0] && (
                  <div className="text-ios-gray-600 text-xs mt-1">
                    Best: {(currentRoute[0].summary.totalDistance / 1000).toFixed(1)} km, 
                    {Math.round(currentRoute[0].summary.totalTime / 60)} min
                  </div>
                )}
              </motion.div>
            )}

            {/* Routing Error Notification */}
            {routingError && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="error-notification"
              >
                <div className="bg-ios-red/90 text-white px-4 py-3 rounded-2xl shadow-lg max-w-sm">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm font-medium">Routing unavailable</span>
                  </div>
                  <p className="text-xs mt-1 opacity-90">Using demo routing service. Tap office for Google Maps directions.</p>
                </div>
              </motion.div>
            )}
          </MapControlPortal>

          {/* Map Layers */}
          <UserLocationMarker
            position={userLocation ? [userLocation.latitude, userLocation.longitude] : null}
            accuracy={userLocation?.accuracy}
          />

          <GeoJSONLayerManager
            activeLayers={activeLayers}
            onOfficeSelect={handleOfficeSelect}
            selectedOffice={selectedOffice}
            onNearbyOfficesFound={setNearbyOffices}
          />

          {lastTapLocation && (
            <UserLocationMarker
              position={[lastTapLocation.lat, lastTapLocation.lng]}
              accuracy={100}
              color="#FF9500"
            />
          )}

          {/* Enhanced Routing System */}
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
      </div>

      {/* External UI Components */}
      <LayerControlPanel
        layers={activeLayers}
        onToggleLayer={toggleLayer}
        isOpen={isLayerPanelOpen}
        onClose={closeLayerPanel}
        userLocation={userLocation}
      />

      <OfficeBottomSheet
        office={selectedOffice || nearestOffice}
        userLocation={userLocation}
        onOfficeSelect={handleOfficeSelect}
        currentRoute={currentRoute}
        routingError={routingError}
      />

      <AnimatePresence>
        {isListPanelOpen && (
          <OfficeListPanel
            offices={nearbyOffices.length > 0 ? nearbyOffices : (searchQuery ? filteredOffices : defaultNearbyOffices)}
            onSelectOffice={handleOfficeSelect}
            onClose={closeListPanel}
            searchQuery={searchQuery}
            userLocation={userLocation}
            isSearching={isSearchingNearby}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default IEBCOfficeMap;
