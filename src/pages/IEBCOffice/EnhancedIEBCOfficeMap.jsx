import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import EnhancedMapContainer from '../../components/IEBCOffice/EnhancedMapContainer';
import UserLocationMarker from '../../components/IEBCOffice/UserLocationMarker';
import GeoJSONLayerManager from '../../components/IEBCOffice/GeoJSONLayerManager';
import RoutingSystem from '../../components/IEBCOffice/RoutingSystem';
import LayerControlPanel from '../../components/IEBCOffice/LayerControlPanel';
import OfficeBottomSheet from '../../components/IEBCOffice/OfficeBottomSheet';
import OfficeListPanel from '../../components/IEBCOffice/OfficeListPanel';
import SearchBar from '../../components/IEBCOffice/SearchBar';
import LoadingSpinner from '../../components/IEBCOffice/LoadingSpinner';
import { OfflineBanner } from '@/components/OfflineBanner';
import OfflineRouteDownloader from '../../components/IEBCOffice/OfflineRouteDownloader';
import { getTravelInsights } from '@/services/travelService';
import { useIEBCOffices } from '../../hooks/useIEBCOffices';
import { useMapControls } from '../../hooks/useMapControls';
import { findNearestOffice, findNearestOffices } from '../../utils/geoUtils';
import { useTheme } from '@/contexts/ThemeContext';
import { Thermometer, Wind, CloudRain, ChevronRight } from 'lucide-react';

const EnhancedIEBCOfficeMap = () => {
  const { t } = useTranslation('nasaka');
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
  const [travelInsights, setTravelInsights] = useState(null);
  const [isOfflineSidebarOpen, setIsOfflineSidebarOpen] = useState(false);
  const downloaderRef = useRef(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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

  // Handle route found event — also triggers travel intelligence
  const handleRouteFound = useCallback(async (routes) => {
    setCurrentRoute(routes);
    // Fetch travel difficulty score when route is found
    if (userLocation?.latitude && userLocation?.longitude && selectedOffice?.latitude && selectedOffice?.longitude) {
      try {
        const insights = await getTravelInsights(
          [userLocation.latitude, userLocation.longitude],
          [selectedOffice.latitude, selectedOffice.longitude],
          {
            name: selectedOffice.constituency_name || selectedOffice.displayName,
            county: selectedOffice.county,
            verified: selectedOffice.verified
          }
        );
        setTravelInsights(insights);
      } catch (err) {
        // Non-blocking: travel insights are a nice-to-have enhancement
        setTravelInsights(null);
      }
    }
  }, [userLocation, selectedOffice]);

  // Handle route error
  const handleRouteError = useCallback((error) => {
    console.error('Routing error:', error);
    setCurrentRoute(null);
    setTravelInsights(null);
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
    navigate('/', { replace: true });
  };

  const openLayerPanel = () => {
    setIsLayerPanelOpen(true);
  };

  const closeLayerPanel = () => {
    setIsLayerPanelOpen(false);
  };

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
      {/* Offline Status Banner */}
      <OfflineBanner className="absolute top-0 left-0 right-0 z-50" />

      {/* Enhanced Map Container */}
      <EnhancedMapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full"
        showLayerControl={true}
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
      </EnhancedMapContainer>

      {/* Top Bar */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute top-0 left-0 right-0 p-4 pointer-events-none"
      >
        <div className="glass-morphism rounded-2xl p-2 flex items-center space-x-2 pointer-events-auto elevation-low">
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

      {/* Layer Control Panel */}
      <LayerControlPanel
        layers={activeLayers}
        onToggleLayer={toggleLayer}
        isOpen={isLayerPanelOpen}
        onClose={closeLayerPanel}
        userLocation={userLocation}
      />

      {/* ── RIGHT-SIDE MAP CONTROL: Offline Download ── */}
      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
        onClick={() => setIsOfflineSidebarOpen(true)}
        style={{ zIndex: 'var(--z-fixed-badges, 1005)' }}
        className={`absolute right-4 bottom-28 w-11 h-11 rounded-full flex items-center justify-center shadow-lg border transition-all active:scale-95 ${isDark
          ? 'bg-card/90 backdrop-blur-xl border-border text-ios-blue-400 hover:bg-card'
          : 'bg-white/90 backdrop-blur-xl border-black/5 text-ios-blue hover:bg-white'
          }`}
        aria-label="Offline downloader"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </motion.button>

      {/* ── PREMIUM OFFLINE SIDEBAR ── */}
      <AnimatePresence>
        {isOfflineSidebarOpen && (
          <>
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOfflineSidebarOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[2000]"
            />

            {/* Sidebar Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`
                absolute right-0 top-0 bottom-0 w-80 md:w-96 z-[2001]
                shadow-2xl flex flex-col border-l
                ${isDark ? 'bg-ios-gray-900/80 border-white/10' : 'bg-white/80 border-black/5'}
                backdrop-blur-3xl
              `}
            >
              {/* Header */}
              <div className="p-6 flex items-center justify-between border-b border-white/10">
                <div>
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>
                    {t('offline.sidebarTitle', 'Offline Access')}
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>
                    {t('offline.title', 'Offline Trip Protection')}
                  </p>
                </div>
                <button
                  onClick={() => setIsOfflineSidebarOpen(false)}
                  className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'} transition-colors`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {/* Feature Explanation */}
                <div className={`
                  mb-8 p-4 rounded-2xl border
                  ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}
                `}>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-xl bg-ios-blue/20">
                      <svg className="w-5 h-5 text-ios-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                        {t('offline.stayPrepared', 'Stay Prepared')}
                      </h4>
                      <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-ios-gray-300' : 'text-ios-gray-600'}`}>
                        {t('offline.featureExplanation', 'This tool caches map tiles along your route or destination.')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Downloader Component */}
                {(currentRoute?.[0] || selectedOffice) ? (
                  <div className="space-y-6">
                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-black/20 border-white/5' : 'bg-white/40 border-black/5'}`}>
                      <OfflineRouteDownloader
                        ref={downloaderRef}
                        routeGeometry={currentRoute?.[0]?.coordinates || currentRoute?.[0]?.geometry || currentRoute?.[0] || (selectedOffice ? { type: 'Point', coordinates: [selectedOffice.longitude, selectedOffice.latitude] } : null)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-ios-gray-100 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-ios-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                    </div>
                    <p className={`text-sm font-medium ${isDark ? 'text-ios-gray-400' : 'text-ios-gray-600'}`}>
                      {t('offline.selectToEnable', 'Select an office or route to enable offline downloads')}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/10">
                <button
                  onClick={() => setIsOfflineSidebarOpen(false)}
                  className="w-full py-4 rounded-2xl bg-ios-blue text-white font-bold active:scale-95 transition-all shadow-lg shadow-ios-blue/20"
                >
                  {t('common.close', 'Done')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Sheet */}
      <OfficeBottomSheet
        office={selectedOffice || nearestOffice}
        userLocation={userLocation}
        onOfficeSelect={handleOfficeSelect}
        currentRoute={currentRoute}
        travelInsights={travelInsights}
      />

      {/* Office List Panel */}
      <AnimatePresence>
        {isListPanelOpen && (
          <OfficeListPanel
            offices={searchQuery ? filteredOffices : nearbyOffices}
            onSelectOffice={handleOfficeSelect}
            onClose={closeListPanel}
            searchQuery={searchQuery}
            userLocation={userLocation}
          />
        )}
      </AnimatePresence>

      {/* Route Information Badge + Travel Score */}
      {currentRoute && currentRoute.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ zIndex: 'var(--z-fixed-badges, 1005)' }}
          className="absolute top-20 right-4 bg-card/90 backdrop-blur-xl rounded-2xl p-3 shadow-lg border border-border max-w-[240px]"
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-foreground text-sm font-semibold">
                {currentRoute.length} route{currentRoute.length > 1 ? 's' : ''} found
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          {currentRoute[0] && (
            <div className="text-muted-foreground text-xs mt-1">
              Best: {(currentRoute[0].summary.totalDistance / 1000).toFixed(1)} km,
              {Math.round(currentRoute[0].summary.totalTime / 60)} min
            </div>
          )}

          {/* Integrated Travel Score + Weather (unified view) */}
          {travelInsights && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Visit Score</span>
                  {travelInsights.weatherDesc && (
                    <span className="text-xs text-muted-foreground">·</span>
                  )}
                  {travelInsights.weatherDesc && (
                    <span className="text-xs text-muted-foreground">
                      {travelInsights.weatherDesc}
                    </span>
                  )}
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${travelInsights.severity === 'low'
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                  : travelInsights.severity === 'medium'
                    ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                    : 'bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}>
                  {travelInsights.score}/100
                </span>
              </div>
              {travelInsights.temperature !== null && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Thermometer className="w-3 h-3" /> {travelInsights.temperature}°C
                  </span>
                  {travelInsights.windSpeed !== null && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      · <Wind className="w-3 h-3" /> {travelInsights.windSpeed} km/h
                    </span>
                  )}
                  {travelInsights.precipProb !== null && travelInsights.precipProb > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      · <CloudRain className="w-3 h-3" /> {travelInsights.precipProb}%
                    </span>
                  )}
                </div>
              )}
              {travelInsights.stale && (
                <p className="text-xs text-muted-foreground/60 mt-0.5 italic text-center">May be stale</p>
              )}
              {travelInsights.aiScore !== null && travelInsights.aiScore !== undefined && (
                <div className="mt-1.5 pt-1.5 border-t border-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">AI Intelligence</span>
                    <div className="flex items-center gap-1">
                      {travelInsights.aiGroundTruthVerified && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/20 text-green-600 dark:text-green-400 font-bold">✓ Verified</span>
                      )}
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${travelInsights.aiConfidence === 'high'
                        ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                        : travelInsights.aiConfidence === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                          : 'bg-red-500/20 text-red-600 dark:text-red-400'
                        }`}>{travelInsights.aiScore}/100</span>
                    </div>
                  </div>
                  {travelInsights.aiReason && (
                    <p className="text-[9px] text-muted-foreground/70 mt-0.5 leading-tight">{travelInsights.aiReason}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default EnhancedIEBCOfficeMap;
