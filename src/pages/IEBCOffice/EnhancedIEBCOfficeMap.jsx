import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Circle } from 'react-leaflet';
import EnhancedMapContainer from '../../components/IEBCOffice/EnhancedMapContainer';
import UserLocationMarker from '../../components/IEBCOffice/UserLocationMarker';
import GeoJSONLayerManager from '../../components/IEBCOffice/GeoJSONLayerManager';
import RoutingSystem from '../../components/IEBCOffice/RoutingSystem';
import LayerControlPanel from '../../components/IEBCOffice/LayerControlPanel';
import OfficeBottomSheet from '../../components/IEBCOffice/OfficeBottomSheet';
import OfficeListPanel from '../../components/IEBCOffice/OfficeListPanel';
import SearchBar from '../../components/IEBCOffice/SearchBar';
import LoadingSpinner from '../../components/IEBCOffice/LoadingSpinner';
import { useIEBCOffices } from '../../hooks/useIEBCOffices';
import { useMapControls } from '../../hooks/useMapControls';
import { findNearestOffice, findNearestOffices } from '../../utils/geoUtils';
import '../../styles/iebc-office.css';

const EnhancedIEBCOfficeMap = () => {
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

  // Layer management state
  const [activeLayers, setActiveLayers] = useState(['iebc-offices']);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [searchRadius, setSearchRadius] = useState(null);

  // Set initial map center based on user location or default
  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      flyToLocation(userLocation.latitude, userLocation.longitude, 14);
    }
  }, [userLocation, flyToLocation]);

  // Find nearest office when data loads and user location is available
  const nearestOffice = useMemo(() => {
    if (userLocation?.latitude && userLocation?.longitude && offices.length > 0) {
      return findNearestOffice(userLocation.latitude, userLocation.longitude, offices);
    }
    return null;
  }, [userLocation, offices]);

  // Set nearest office as selected if none is selected
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
  const nearbyOffices = useMemo(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      return findNearestOffices(userLocation.latitude, userLocation.longitude, offices, 20);
    }
    return offices.slice(0, 20);
  }, [userLocation, offices]);

  // Handle office selection from any source (marker, list, search)
  const handleOfficeSelect = useCallback((office) => {
    setSelectedOffice(office);
    flyToOffice(office);
    closeListPanel();
  }, [setSelectedOffice, flyToOffice, closeListPanel]);

  // Handle route found event
  const handleRouteFound = useCallback((routes) => {
    setCurrentRoute(routes);
    console.log('Route found with alternatives:', routes.length);
  }, []);

  // Handle route error
  const handleRouteError = useCallback((error) => {
    console.error('Routing error:', error);
    setCurrentRoute(null);
  }, []);

  // Toggle layer visibility
  const toggleLayer = useCallback((layerId) => {
    setActiveLayers(prev => 
      prev.includes(layerId) 
        ? prev.filter(id => id !== layerId)
        : [...prev, layerId]
    );
  }, []);

  const handleBack = () => {
    navigate(-1);
  };

  const handleSearchFocus = () => {
    openListPanel();
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
  };

  const handleRetryLocation = () => {
    navigate('/nasaka-iebc', { replace: true });
  };

  const openLayerPanel = () => {
    setIsLayerPanelOpen(true);
  };

  const closeLayerPanel = () => {
    setIsLayerPanelOpen(false);
  };

  // Handle double-tap on map to search area
  const handleMapClick = useCallback((e) => {
    const currentTime = new Date().getTime();
    const tapGap = currentTime - lastTapTime;
    
    if (tapGap < 300 && tapGap > 0) {
      // Double tap detected
      const { lat, lng } = e.latlng;
      
      // Search for offices within 5km radius
      const nearbyOffices = findNearestOffices(lat, lng, offices, 10);
      
      if (nearbyOffices.length > 0) {
        // Show search radius circle
        setSearchRadius({ lat, lng, radius: 5000 });
        
        // Open list panel with results
        setSearchQuery(`Around ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        openListPanel();
        
        // Fly to the tapped location
        flyToLocation(lat, lng, 13);
        
        // Clear search radius after 3 seconds
        setTimeout(() => setSearchRadius(null), 3000);
      }
    }
    
    setLastTapTime(currentTime);
  }, [lastTapTime, offices, flyToLocation, openListPanel, setSearchQuery]);

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
    <div className="relative h-screen w-full bg-ios-bg overflow-hidden">
      {/* Enhanced Map Container */}
      <EnhancedMapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full"
        showLayerControl={true}
        onClick={handleMapClick}
      >
        {/* User Location Marker */}
        {userLocation && (
          <UserLocationMarker
            position={[userLocation.latitude, userLocation.longitude]}
            accuracy={userLocation.accuracy}
          />
        )}

        {/* GeoJSON Layers */}
        <GeoJSONLayerManager
          activeLayers={activeLayers}
          onOfficeSelect={handleOfficeSelect}
          selectedOffice={selectedOffice}
        />

        {/* Routing System */}
        {userLocation && selectedOffice && (
          <RoutingSystem
            userLocation={userLocation}
            destination={selectedOffice}
            onRouteFound={handleRouteFound}
            onRouteError={handleRouteError}
            showAlternatives={true}
          />
        )}

        {/* Search Radius Visualization */}
        {searchRadius && (
          <Circle
            center={[searchRadius.lat, searchRadius.lng]}
            radius={searchRadius.radius}
            pathOptions={{
              color: '#007AFF',
              fillColor: '#007AFF',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '5, 10'
            }}
          />
        )}
      </EnhancedMapContainer>

      {/* Top Bar - Fixed with high z-index */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute top-0 left-0 right-0 p-4 pointer-events-none z-[1000]"
      >
        <div className="glass-morphism rounded-2xl p-2 flex items-center space-x-2 pointer-events-auto elevation-low shadow-xl bg-white/95 backdrop-blur-xl">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl hover:bg-ios-gray-100 transition-colors"
            aria-label="Go back"
          >
            <svg className="w-6 h-6 text-ios-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              placeholder="Search by county, constituency..."
            />
          </div>

          {/* Layer Control Button */}
          <button
            onClick={openLayerPanel}
            className="p-2 rounded-xl hover:bg-ios-gray-100 transition-colors"
            aria-label="Map layers"
          >
            <svg className="w-6 h-6 text-ios-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </button>

          {!userLocation && (
            <button
              onClick={handleRetryLocation}
              className="p-2 rounded-xl hover:bg-ios-gray-100 transition-colors"
              aria-label="Use my location"
            >
              <svg className="w-6 h-6 text-ios-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          <button
            onClick={openListPanel}
            className="p-2 rounded-xl hover:bg-ios-gray-100 transition-colors"
            aria-label="Show all offices"
          >
            <svg className="w-6 h-6 text-ios-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </motion.div>

      {/* Layer Control Panel - High z-index */}
      <div className="z-[1100]">
        <LayerControlPanel
          layers={activeLayers}
          onToggleLayer={toggleLayer}
          isOpen={isLayerPanelOpen}
          onClose={closeLayerPanel}
          userLocation={userLocation}
        />
      </div>

      {/* Bottom Sheet */}
      <OfficeBottomSheet
        office={selectedOffice || nearestOffice}
        userLocation={userLocation}
        onOfficeSelect={handleOfficeSelect}
        currentRoute={currentRoute}
      />

      {/* Office List Panel - Highest z-index */}
      <AnimatePresence>
        {isListPanelOpen && (
          <div className="z-[1200]">
            <OfficeListPanel
              offices={searchQuery ? filteredOffices : nearbyOffices}
              onSelectOffice={handleOfficeSelect}
              onClose={closeListPanel}
              searchQuery={searchQuery}
              userLocation={userLocation}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Route Information Badge */}
      {currentRoute && currentRoute.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-20 right-4 bg-white/90 backdrop-blur-sm rounded-2xl p-3 shadow-lg border border-ios-gray-200"
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
    </div>
  );
};

export default EnhancedIEBCOfficeMap;
