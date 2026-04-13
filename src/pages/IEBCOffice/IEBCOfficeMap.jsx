import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useMapEvents } from 'react-leaflet';
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
import OfflineRouteDownloader from '@/components/IEBCOffice/OfflineRouteDownloader';
import LanguageSwitcher from '@/components/LanguageSwitcher/LanguageSwitcher';
import RadiusCircle from '@/components/map/RadiusCircle';
import MapModeToggle from '@/components/map/MapModeToggle';
import { useIEBCOffices } from '@/hooks/useIEBCOffices';
import { useMapControls } from '@/hooks/useMapControls';
import { useMapStateMachine } from '@/hooks/useMapStateMachine';
import { findNearestOffice, findNearestOffices } from '@/utils/geoUtils';
import { supabase } from '@/integrations/supabase/client';
import { getTrafficInfo } from '@/utils/kenyaFareCalculator';
import { getTravelInsights } from '@/services/travelService';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import { SEOHead, slugify, deslugify } from '@/components/SEO/SEOHead';
import { resolveLocation } from '@/lib/geocoding/pipeline';
import { debounce } from '@/lib/searchUtils';

const MapBoundsListener = ({ onBoundsChange }) => {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      onBoundsChange({
        minLat: bounds.getSouth(),
        minLng: bounds.getWest(),
        maxLat: bounds.getNorth(),
        maxLng: bounds.getEast()
      }, zoom);
    },
    zoomend: () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      onBoundsChange({
        minLat: bounds.getSouth(),
        minLng: bounds.getWest(),
        maxLat: bounds.getNorth(),
        maxLng: bounds.getEast()
      }, zoom);
    }
  });
  return null;
};

const MapZoomDisclaimer = ({ isVisible, t }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className="mb-3 pointer-events-none max-w-[260px] text-center"
      >
        <div
          className="px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-2xl flex items-center space-x-3 border"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 107, 255, 0.9), rgba(20, 80, 200, 0.95))',
            borderColor: 'rgba(255, 255, 255, 0.25)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.3)'
          }}
        >
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0 shadow-inner border border-white/10">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/70 leading-none mb-1">
              {t('splash.precisionViewTitle', 'Precision View')}
            </span>
            <span className="text-[12px] font-black text-white leading-tight">
              {t('splash.precisionViewDesc', 'Zoom in (Level 12+) to see all 30k+ registration centres')}
            </span>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const IEBCOfficeMap = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { query: urlQueryParam, countySlug, constituencySlug, wardSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const stateUserLocation = state?.userLocation;
  const manualEntry = state?.manualEntry;
  const { t } = useTranslation('nasaka');
  const { theme } = useTheme();

  const isDark = theme === 'dark';

  // Fix 5: Recover userLocation from sessionStorage if not in navigation state
  const userLocation = useMemo(() => {
    if (stateUserLocation) {
      // Persist for future return navigation
      try {
        sessionStorage.setItem('nasaka_userLocation', JSON.stringify(stateUserLocation));
      } catch (_) { /* private browsing */ }
      return stateUserLocation;
    }
    // Fallback: recover from sessionStorage
    try {
      const stored = sessionStorage.getItem('nasaka_userLocation');
      return stored ? JSON.parse(stored) : null;
    } catch (_) { return null; }
  }, [stateUserLocation]);

  // CRITICAL: Determine if we have location access
  const hasLocationAccess = !!userLocation;

  const { offices, viewportOffices, loading, error, offlineWarning, isOffline, searchOffices, refetch, fetchInBounds } = useIEBCOffices();
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
  const [travelInsights, setTravelInsights] = useState({});
  const [showOfflineDownloader, setShowOfflineDownloader] = useState(false);
  const [mapMode, setMapMode] = useState('kenya');
  const [radiusCenter, setRadiusCenter] = useState(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [isRadiusAnimating, setIsRadiusAnimating] = useState(false);
  const [showZoomDisclaimer, setShowZoomDisclaimer] = useState(false);

  // Uber-style state machine for map zoom transitions
  const { mapState, dispatchMap } = useMapStateMachine();

  const offlineDownloaderRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayersRef = useRef({});
  const accuracyCircleRef = useRef(null);
  const routeBadgeRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const badgeStartPos = useRef({ x: 0, y: 0 });
  const stateOfficeProcessed = useRef(false);

  // ─── Logic Functions (useCallback) ──────────────────────────────────────────

  // Initialize map reference
  const handleMapReady = useCallback((map) => {
    mapInstanceRef.current = map;
    initializeTileLayers(map);
  }, []);

  // Initialize tile layers ✊🏽🇰🇪 🌍
  const initializeTileLayers = useCallback((map) => {
    const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY;
    const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

    // Robust check for MapTiler key — prevents "undefined" string key 403s
    const isMapTilerValid = MAPTILER_KEY && 
                           MAPTILER_KEY !== 'undefined' && 
                           MAPTILER_KEY !== 'null' && 
                           String(MAPTILER_KEY).length > 5;

    // ── Shared config ──────────────────────────────────────────────────────────
    const osmAttrib = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    const mtAttrib = `&copy; <a href="https://www.maptiler.com/">MapTiler</a> ${osmAttrib}`;
    const rasterOpts = { maxZoom: 20, updateWhenIdle: true, keepBuffer: 2, crossOrigin: true };

    // 1. MapTiler Standard (Vector) — requires valid MAPTILER_KEY
    if (isMapTilerValid) {
      // @ts-ignore
      tileLayersRef.current.standard = L.maplibreGL({
        style: `https://api.maptiler.com/maps/openstreetmap/style.json?key=${MAPTILER_KEY}`,
        attribution: mtAttrib,
        crossOrigin: true
      });
    } else {
      // Fallback to OSM Raster if key is missing or invalid ✊🏽🇰🇪
      tileLayersRef.current.standard = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: osmAttrib, ...rasterOpts }
      );
    }

    // 2. Esri Satellite (Raster) — no key required
    tileLayersRef.current.satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
        ...rasterOpts
      }
    );

    // 3. TomTom Retro Style — requires TOMTOM_KEY
    if (TOMTOM_KEY) {
      // @ts-ignore
      tileLayersRef.current.retro = L.tileLayer(
        `https://{s}.api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`,
        {
          attribution: '&copy; <a href="https://www.tomtom.com/">TomTom</a>',
          subdomains: 'abcd',
          ...rasterOpts
        }
      );
    } else {
      tileLayersRef.current.retro = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> ' + osmAttrib,
          subdomains: 'abcd',
          ...rasterOpts
        }
      );
    }

    // 7. Stadia Alidade Smooth — no key required ✨
    tileLayersRef.current.stadia = L.tileLayer(
      'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> ' + osmAttrib,
        ...rasterOpts
      }
    );

    // 8. Stadia Alidade Smooth Dark — no key required 🌙
    tileLayersRef.current['stadia-dark'] = L.tileLayer(
      'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> ' + osmAttrib,
        ...rasterOpts
      }
    );

    // 9. CartoDB Positron (clean, minimal) — no key required 🗺️
    tileLayersRef.current.carto = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> ' + osmAttrib,
        subdomains: 'abcd',
        ...rasterOpts
      }
    );

    // 10. CartoDB Dark Matter — no key required 🌑
    tileLayersRef.current['carto-dark'] = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> ' + osmAttrib,
        subdomains: 'abcd',
        ...rasterOpts
      }
    );

    // 11. OpenTopoMap — no key required 🏔️
    tileLayersRef.current.topo = L.tileLayer(
      'https://tile.opentopomap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> ' + osmAttrib,
        maxZoom: 17, updateWhenIdle: true, keepBuffer: 2, crossOrigin: true
      }
    );

    // 12. Humanitarian OSM (HOT) — no key required ❤️
    tileLayersRef.current.humanitarian = L.tileLayer(
      'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.hotosm.org">Humanitarian OSM</a> ' + osmAttrib,
        subdomains: 'abc',
        ...rasterOpts
      }
    );

    // Initial base map selection based on theme — carto-dark for dark mode (zero-key, always works)
    const initialLayer = isDark ? 'carto-dark' : 'standard';
    tileLayersRef.current[initialLayer].addTo(map);
  }, [isDark]);


  // Enhanced office selection
  const handleOfficeSelect = useCallback(async (office) => {
    let enhancedOffice = office;

    if (office.id && (!office.constituency_name || !office.county)) {
      try {
        const { data: fullOffice, error } = await supabase
          .from('iebc_offices')
          .select('id, county, constituency, constituency_name, office_location, latitude, longitude, verified, formatted_address, landmark, landmark_normalized, landmark_source, walking_effort, elevation_meters, geocode_verified, geocode_verified_at, multi_source_confidence, created_at, updated_at')
          .eq('id', office.id)
          .single();

        if (!error && fullOffice) {
          enhancedOffice = fullOffice;
        }
      } catch (err) {
        // Log removed for production
      }
    }

    setSelectedOffice(enhancedOffice);
    flyToOffice(enhancedOffice);
    closeListPanel();
    setBottomSheetState('peek');
    setRoutingError(null);
  }, [setSelectedOffice, flyToOffice, closeListPanel]);

  // Utility to navigate to office detail page ✊🏽🇰🇪
  const navigateToArea = useCallback((office) => {
    if (!office) return;
    const countySlug = slugify(office.county || 'kenya');
    let areaSlug = slugify(office.constituency_name || office.city || '');
    const wardSlug = office.ward_name ? slugify(office.ward_name) : null;

    if (wardSlug && areaSlug) {
      navigate(`/${countySlug}/${areaSlug}/${wardSlug}`);
    } else if (areaSlug) {
      if (areaSlug === countySlug) areaSlug = `${areaSlug}-town`;
      navigate(`/${countySlug}/${areaSlug}`);
    } else {
      navigate(`/${countySlug}`);
    }
  }, [navigate, slugify]);

  // Function to handle URL query parameter search
  const handleUrlQuerySearch = async (query) => {
    if (!query.trim()) return;

    try {
      console.info('[Nasaka] Resolving search query:', query);

      // 1. Precise geocoding via pipeline
      const location = await resolveLocation(query);
      if (!location) throw new Error('Could not resolve location');

      const { lat, lon } = location;

      // 2. Find nearest office to this result
      const nearest = findNearestOffice(lat, lon, offices);

      if (nearest) {
        // 3. Construct canonical hierarchical path for /map
        const county = slugify(nearest.county);
        const constituency = slugify(nearest.constituency_name);
        const ward = nearest.ward_name ? slugify(nearest.ward_name) : 'centre';

        // 4. Redirect to canonical path immediately
        navigate(`/map/${county}/${constituency}/${ward}?lat=${lat}&lng=${lon}&q=${encodeURIComponent(query)}`, { replace: true });
      }

      setUrlQueryProcessed(true);
    } catch (error) {
      console.warn('[Nasaka] URL Search failed:', error);
      setUrlQueryProcessed(true);
    }
  };

  // Enhanced search handler
  const handleSearch = useCallback(async (result) => {
    if (result.searchQuery) {
      const results = searchOffices(result.searchQuery);
      setSearchResults(results);
      setNearbyOffices(results);
      openListPanel();
      setIsPanelBackdropVisible(true);

      if (results.length > 0 && results[0].latitude && results[0].longitude) {
        dispatchMap({ type: 'OFFICES_FOUND', offices: results, radiusKm: 50 }, mapInstanceRef.current);
      }
    } else if (result.latitude && result.longitude) {
      handleOfficeSelect(result);
      dispatchMap({ type: 'OFFICE_SELECTED', officeId: result.id }, mapInstanceRef.current);
    } else {
      handleOfficeSelect(result);
    }
  }, [searchOffices, handleOfficeSelect, openListPanel, dispatchMap]);

  // Double-tap handler for area search
  const handleDoubleTap = useCallback(async (latlng) => {
    // We bypass hasLocationAccess here because double-tap provides explicit coordinates
    // and URL redirection flow should work even if user hasn't shared their *current* location yet
    setIsSearchingNearby(true);
    setLastTapLocation(latlng);

    try {
      console.info('[Nasaka] Searching nearby offices for:', latlng);
      const nearby = await searchNearbyOffices(latlng.lat, latlng.lng, 5000);
      setNearbyOffices(nearby);
      setSearchResults(nearby);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([latlng.lat, latlng.lng], 14, {
          duration: 1
        });
      }

      setRadiusCenter([latlng.lat, latlng.lng]);
      setRadiusKm(5);
      setIsRadiusAnimating(true);
      setTimeout(() => setIsRadiusAnimating(false), 3000);

      openListPanel();
      setIsPanelBackdropVisible(true);

      setTimeout(() => {
        setLastTapLocation(null);
      }, 3000);
    } catch (error) {
      console.warn('[Nasaka] Nearby search failed:', error);
    } finally {
      setIsSearchingNearby(false);
    }
  }, [openListPanel]);

  // Handle route found event
  const handleRouteFound = useCallback(async (routes) => {
    setCurrentRoute(routes);
    setRoutingError(null);

    if (routes?.[0] && userLocation?.latitude && userLocation?.longitude && selectedOffice?.latitude && selectedOffice?.longitude) {
      try {
        const insights = await getTravelInsights(
          [userLocation.latitude, userLocation.longitude],
          [selectedOffice.latitude, selectedOffice.longitude]
        );

        setTravelInsights({
          ...insights,
          trafficCondition: insights.severity === 'low' ? t('bottomSheet.smoothTraffic', 'Smooth traffic') :
            insights.severity === 'medium' ? t('bottomSheet.moderateTraffic', 'Moderate traffic') : t('bottomSheet.heavyTraffic', 'Heavy traffic'),
          trafficColor: insights.severity === 'low' ? 'text-green-600 dark:text-green-400' :
            insights.severity === 'medium' ? 'text-amber-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
          trafficIcon: 'car',
          routeDistance: insights.distanceKm,
          routeTime: insights.timeMins
        });
      } catch (err) {
        const trafficInfo = getTrafficInfo();
        setTravelInsights({
          trafficCondition: trafficInfo?.description || t('bottomSheet.normalTraffic', 'Normal traffic'),
          trafficIcon: trafficInfo?.icon || 'car',
          trafficColor: trafficInfo?.color || 'text-green-600 dark:text-green-400',
          routeDistance: (routes[0].summary.totalDistance / 1000).toFixed(1),
          routeTime: Math.round(routes[0].summary.totalTime / 60),
          severity: 'low',
          score: 10,
          weatherDesc: t('bottomSheet.checkingStatus', 'Checking...'),
          weatherIcon: 'cloudy'
        });
      }
    } else if (routes?.[0]) {
      const trafficInfo = getTrafficInfo();
      setTravelInsights({
        trafficCondition: trafficInfo?.description || t('bottomSheet.normalTraffic', 'Normal traffic'),
        trafficIcon: trafficInfo?.icon || 'car',
        trafficColor: trafficInfo?.color || 'text-green-500',
        routeDistance: (routes[0].summary.totalDistance / 1000).toFixed(1),
        routeTime: Math.round(routes[0].summary.totalTime / 60),
      });
    }
  }, [userLocation, selectedOffice]);

  // Handle route error
  const handleRouteError = useCallback((error) => {
    setRoutingError(error?.message || t('bottomSheet.routingError', 'Failed to calculate route'));
    setCurrentRoute(null);
  }, [t]);

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

  const boundsChangeTimerRef = useRef(null);
  const handleBoundsChange = useCallback((bounds, zoom) => {
    // Debounce viewport fetches — animated zoom fires moveend+zoomend rapidly
    if (boundsChangeTimerRef.current) clearTimeout(boundsChangeTimerRef.current);
    boundsChangeTimerRef.current = setTimeout(() => {
      fetchInBounds(bounds, zoom);
    }, 300);
    setShowZoomDisclaimer(zoom < 12 && mapMode === 'kenya');
  }, [fetchInBounds, mapMode]);

  // Navigation handlers
  const handleBack = () => navigate(-1);
  const handleSearchFocus = () => {
    openListPanel();
    setIsPanelBackdropVisible(true);
  };

  const handleRetryLocation = () => navigate('/', { replace: true });

  // Uber-style: handle place search from SearchBar
  const handleLocationSearch = useCallback(async (placeData) => {
    if (!placeData || (!placeData.latitude && !placeData.longitude)) {
      navigate('/', { replace: true });
      return;
    }

    const { latitude, longitude } = placeData;
    const searchRadiusKm = 15;

    dispatchMap({ type: 'SEARCH_STARTED', lat: latitude, lng: longitude }, mapInstanceRef.current);

    setRadiusCenter([latitude, longitude]);
    setRadiusKm(searchRadiusKm);
    setIsRadiusAnimating(true);
    setIsSearchingNearby(true);

    try {
      const { data: rpcResults, error: rpcError } = await supabase.rpc('find_offices_near_place', {
        search_lat: latitude,
        search_lng: longitude,
        radius_km: searchRadiusKm,
        max_results: 20,
      });

      let nearby;
      if (!rpcError && rpcResults && rpcResults.length > 0) {
        nearby = rpcResults;
      } else {
        nearby = await searchNearbyOffices(latitude, longitude, searchRadiusKm * 1000);
      }

      setNearbyOffices(nearby);
      setSearchResults(nearby);
      dispatchMap({ type: 'OFFICES_FOUND', offices: nearby, radiusKm: searchRadiusKm }, mapInstanceRef.current);
      setTimeout(() => setIsRadiusAnimating(false), 2000);
      openListPanel();
      setIsPanelBackdropVisible(true);
    } catch (err) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([latitude, longitude], 13, { duration: 1.0 });
      }
      setIsRadiusAnimating(false);
    } finally {
      setIsSearchingNearby(false);
    }
  }, [dispatchMap, openListPanel, navigate]);

  // Map mode change handler
  const handleMapModeChange = useCallback((newMode) => {
    setMapMode(newMode);
    if (mapInstanceRef.current) {
      if (newMode === 'diaspora') {
        mapInstanceRef.current.flyTo([10, 20], 2, {
          duration: 2.5,
          easeLinearity: 0.15,
        });
      } else {
        if (userLocation?.latitude && userLocation?.longitude) {
          mapInstanceRef.current.flyTo([userLocation.latitude, userLocation.longitude], 13, {
            duration: 2.0,
            easeLinearity: 0.2,
          });
        } else {
          mapInstanceRef.current.flyTo([-0.0236, 37.9062], 6, {
            duration: 2.0,
            easeLinearity: 0.2,
          });
        }
      }
    }
    setRadiusCenter(null);
    setIsRadiusAnimating(false);
  }, [userLocation]);

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

  // Handle contribution success
  const handleContributionSuccess = useCallback((result) => {
    refetch();
  }, [refetch]);

  // Route badge drag handlers
  const handleRouteBadgeMouseDown = useCallback((e) => {
    if (!hasLocationAccess) return;

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
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [hasLocationAccess, isDraggingRouteBadge, routeBadgePosition]);

  // Handle URL query parameters from browser search bar (Safe reference after initializations)
  useEffect(() => {
    if (loading) return;

    // 1. Handle legacy route-based query (:query)
    if (urlQueryParam && !urlQueryProcessed) {
      console.info('[Nasaka] Processing browser URL search query:', urlQueryParam);
      setSearchQuery(urlQueryParam);
      setUrlQueryProcessed(true);

      // Auto-trigger search optimization
      const results = searchOffices(urlQueryParam);
      if (results && results.length > 0) {
        setSearchResults(results);
        // If exact match (e.g. county name), zoom to first result
        const first = results[0];
        if (first.latitude && first.longitude) {
          flyToLocation(first.latitude, first.longitude, 12);
        }
      }
      return;
    }

    // 2. Handle 'search=nearest' parameter (e.g. from About page flow)
    const searchMode = searchParams.get('search');
    const urlLat = searchParams.get('lat');
    const urlLng = searchParams.get('lng');

    if (searchMode === 'nearest' && urlLat && urlLng && !urlQueryProcessed) {
      console.info('[Nasaka] Processing nearest office flow from URL params');
      const lat = parseFloat(urlLat);
      const lng = parseFloat(urlLng);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Trigger the nearby search logic (same as double-tap)
        handleDoubleTap({ lat, lng });
        setUrlQueryProcessed(true);
      }
    }
  }, [urlQueryParam, searchParams, urlQueryProcessed, loading, searchOffices, setSearchQuery, flyToLocation, handleDoubleTap]);

  // ─── Computational Hooks (useMemo) ──────────────────────────────────────────

  // Find nearest office
  const nearestOffice = useMemo(() => {
    if (!hasLocationAccess || !userLocation?.latitude || !userLocation?.longitude || offices.length === 0) {
      return null;
    }
    return findNearestOffice(userLocation.latitude, userLocation.longitude, offices);
  }, [hasLocationAccess, userLocation, offices]);

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


  // ─── Side Effects (useEffect) ───────────────────────────────────────────────

  // 1. Handle explicit selection passed via React Router state (Priority 1) ✊🏽🇰🇪
  useEffect(() => {
    if (state?.selectedOffice && !stateOfficeProcessed.current && offices.length > 0) {
      console.info('[Nasaka] Handling context-preserved office selection from state:', state.selectedOffice.constituency_name);
      handleOfficeSelect(state.selectedOffice);
      stateOfficeProcessed.current = true;
    }
  }, [state, offices, handleOfficeSelect]);

  // Handle URL query parameters from browser search bar
  useEffect(() => {
    if (urlQueryParam && !urlQueryProcessed && !loading) {
      console.info('[Nasaka] Processing browser URL search query:', urlQueryParam);
      setSearchQuery(urlQueryParam);
      setUrlQueryProcessed(true);

      const results = searchOffices(urlQueryParam);
      if (results && results.length > 0) {
        setSearchResults(results);
        const first = results[0];
        if (first.latitude && first.longitude) {
          flyToLocation(first.latitude, first.longitude, 12);
        }
      }
    }
  }, [urlQueryParam, urlQueryProcessed, loading, searchOffices, setSearchQuery, flyToLocation]);

  // Handle URL query parameter or state selection on component mount
  useEffect(() => {
    const query = urlQueryParam || searchParams.get('q');
    if (query && !urlQueryProcessed && offices.length > 0) {
      handleUrlQuerySearch(query);
    }
  }, [searchParams, offices, urlQueryProcessed, state?.selectedOffice, urlQueryParam, handleUrlQuerySearch]);

  // Handle Hierarchical Slugs (e.g. /map/nairobi/westlands)
  useEffect(() => {
    if (offices.length > 0 && (countySlug || constituencySlug || wardSlug)) {
      console.info('[Nasaka] Handling hierarchical slugs:', { countySlug, constituencySlug, wardSlug });

      const matchedOffice = offices.find(o => {
        const cMatch = !countySlug || slugify(o.county) === countySlug;
        const consMatch = !constituencySlug || slugify(o.constituency_name) === constituencySlug;
        const wMatch = !wardSlug || (o.ward_name && slugify(o.ward_name) === wardSlug);
        return cMatch && consMatch && wMatch;
      });

      if (matchedOffice) {
        handleOfficeSelect(matchedOffice);

        const urlLat = searchParams.get('lat');
        const urlLng = searchParams.get('lng');

        if (urlLat && urlLng && mapInstanceRef.current) {
          const lat = parseFloat(urlLat);
          const lng = parseFloat(urlLng);
          setRadiusCenter([lat, lng]);
          setRadiusKm(5);
          setIsRadiusAnimating(true);
        }
      }
    }
  }, [offices, countySlug, constituencySlug, wardSlug, searchParams, userLocation, handleOfficeSelect]);

  // Set initial map center and create accuracy circle
  useEffect(() => {
    if (hasLocationAccess && userLocation?.latitude && userLocation?.longitude) {
      flyToLocation(userLocation.latitude, userLocation.longitude, 14);

      if (userLocation.accuracy && mapInstanceRef.current) {
        if (accuracyCircleRef.current) {
          mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
        }

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

    return () => {
      if (accuracyCircleRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
      }
    };
  }, [hasLocationAccess, userLocation, flyToLocation]);

  // Set nearest office as selected
  useEffect(() => {
    if (nearestOffice && !selectedOffice && !manualEntry && hasLocationAccess && !state?.selectedOffice) {
      setSelectedOffice(nearestOffice);
      setBottomSheetState('peek');
    }
  }, [nearestOffice, selectedOffice, manualEntry, hasLocationAccess, setSelectedOffice, state?.selectedOffice]);

  // 🌓 Auto-switch base map based on theme (Sync with Global Theme)
  useEffect(() => {
    // Only auto-switch if the user is on Standard ↔ Carto-Dark (the managed pair).
    // Any other manual selection (satellite, retro, stadia, topo, humanitarian, carto) is preserved.
    if (isDark && baseMap === 'standard') {
      setBaseMap('carto-dark');
    } else if (!isDark && baseMap === 'carto-dark') {
      setBaseMap('standard');
    }
  }, [isDark, baseMap]);

  // Handle base map changes and Leaflet layer lifecycle 🌍
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayersRef.current.standard) return;

    Object.values(tileLayersRef.current).forEach(layer => {
      if (mapInstanceRef.current.hasLayer(layer)) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });

    if (tileLayersRef.current[baseMap]) {
      tileLayersRef.current[baseMap].addTo(mapInstanceRef.current);

      // Apply dark-mode filter to Satellite imagery to reduce eye strain 🌙
      const mapContainer = mapInstanceRef.current.getContainer();
      if (baseMap === 'satellite' && isDark) {
        mapContainer.classList.add('satellite-dark-mode');
      } else {
        mapContainer.classList.remove('satellite-dark-mode');
      }
    }
  }, [baseMap, isDark]);

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

  const isDiaspora = selectedOffice?.type === 'diaspora';

  // General event cleanup
  useEffect(() => {
    return () => {
      // Removing any possible global listeners on unmount
      // (Using the same pattern as above inside specific active states)
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <LoadingSpinner size="large" showPhrases={true} className="w-full" />
      </div>
    );
  }

  if (error && offices.length === 0) {
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
      {/* SEO Head — map page meta tags */}
      <SEOHead
        title="Nasaka IEBC — Find IEBC Offices near You"
        description="Find IEBC offices in all 47 counties and 290 constituencies. Nasaka IEBC helps Kenyans locate, verify and engage with IEBC service points. Interactive maps, directions, ride-hailing services support, verification and civic reporting for trustworthy electoral access.\ Learn how to register to vote, check status, transfer registration at your nearest IEBC office."
        canonical="/map"
        keywords="IEBC office map, IEBC office locations Kenya, find IEBC office on map, voter registration map Kenya, IEBC office, voter registration Kenya, where to register to vote, IEBC office near me, nearest IEBC office, IEBC constituency office, get registered Kenya, how to register as a voter, check voter registration, IEBC voter verification, transfer voter registration, IEBC contacts, IEBC office hours, IEBC office Nairobi, IEBC office Mombasa, IEBC office Kisumu, IEBC office Nakuru, IEBC office Eldoret, IEBC office Westlands, IEBC office Kasarani, IEBC office Embakasi, voter registration center, where to find IEBC office, visit IEBC constituency office"
      />
      {/* FIXED UI Controls - ALWAYS ON TOP */}
      <div className="fixed-search-container">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onFocus={handleSearchFocus}
          onSearch={handleSearch}
          onLocationSearch={handleLocationSearch}
          placeholder={t('search.placeholder', 'Search IEBC offices by county, constituency, or location...')}
        />

        <AnimatePresence>
          {offlineWarning && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-4 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 shadow-sm"
            >
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-900 truncate">{offlineWarning}</p>
                <p className="text-[10px] text-amber-700 opacity-80">Some features may be limited while offline</p>
              </div>
              <button
                onClick={() => refetch()}
                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-[10px] font-bold rounded-lg transition-colors"
              >
                RETRY
              </button>
            </motion.div>
          )}
        </AnimatePresence>
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

          {/* Offline Download Button */}
          {hasLocationAccess && selectedOffice && (
            <button
              onClick={() => setShowOfflineDownloader(prev => !prev)}
              className="ios-control-btn"
              aria-label={t('offlineDownloader.downloadOffline', 'Download for offline')}
              title="Download route for offline use"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}

          {!hasLocationAccess && (
            <button
              onClick={handleRetryLocation}
              className="ios-control-btn"
              aria-label={t('search.useCurrentLocation', 'Use my location')}
            >
              {/* REPLACED SVG WITH HOME ICON */}
              <svg className="w-5 h-5 text-[#1C1C1E] dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 12.2039C2 9.91549 2 8.77128 2.5192 7.82274C3.0384 6.87421 3.98695 6.28551 5.88403 5.10813L7.88403 3.86687C9.88939 2.62229 10.8921 2 12 2C13.1079 2 14.1106 2.62229 16.116 3.86687L18.116 5.10812C20.0131 6.28551 20.9616 6.87421 21.4808 7.82274C22 8.77128 22 9.91549 22 12.2039V13.725C22 17.6258 22 19.5763 20.8284 20.7881C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.7881C2 19.5763 2 17.6258 2 13.725V12.2039Z" stroke="currentColor" strokeWidth="2" />
                <path d="M9 16C9.85038 16.6303 10.8846 17 12 17C13.1154 17 14.1496 16.6303 15 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

      {/* Map Mode Toggle — Kenya / Diaspora */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:bottom-32 md:translate-x-0 z-[1000] flex flex-col items-center md:items-end">
        <MapZoomDisclaimer isVisible={showZoomDisclaimer} t={t} />
        <MapModeToggle mode={mapMode} onChange={handleMapModeChange} />
      </div>

      {/* Results Summary Pill — shows when place search has results */}
      <AnimatePresence>
        {radiusCenter && nearbyOffices.length > 0 && mapState.phase === 'results' && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-36 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:bottom-48 md:translate-x-0 z-[999]"
          >
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold border"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.88), rgba(240,245,255,0.92))',
                borderColor: 'rgba(200,210,230,0.6)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                boxShadow: '0 4px 20px rgba(30, 107, 255, 0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-gray-700">
                {nearbyOffices.length} {isDiaspora ? 'centre' : 'IEBC office'}{nearbyOffices.length !== 1 ? 's' : ''} within {radiusKm}km
              </span>
              {nearbyOffices[0]?.distance_km != null && (
                <>
                  <span className="text-gray-300">·</span>
                  <span style={{ color: '#1E6BFF', fontWeight: 800 }}>nearest {nearbyOffices[0].distance_km.toFixed(1)}km</span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draggable Route Badge - ONLY WITH LOCATION ACCESS */}
      <AnimatePresence>
        {hasLocationAccess && (isOffline || (currentRoute && currentRoute.length > 0)) && (
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
            className={`route-badge-draggable group ${isDraggingRouteBadge ? 'dragging' : ''} ${isOffline ? 'offline' : ''}`}
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
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 ${isOffline ? 'bg-amber-500' : 'bg-green-500'} rounded-full animate-pulse`}></div>
                <span className="text-sm font-medium">
                  {isOffline
                    ? t('bottomSheet.offlineMode', 'Offline Mode')
                    : t('bottomSheet.routesFound', { count: currentRoute.length })}
                </span>
              </div>
              {!isOffline && <ChevronRight className="w-4 h-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />}
            </div>
            {isOffline ? (
              <div className="text-muted-foreground text-[10px] mt-1 italic">
                {t('bottomSheet.routingUnavailableShort', 'Routing unavailable offline')}
              </div>
            ) : (
              currentRoute?.[0] && (
                <div className="text-muted-foreground text-xs mt-1">
                  {t('bottomSheet.bestRoute', {
                    distance: (currentRoute[0].summary.totalDistance / 1000).toFixed(1),
                    time: Math.round(currentRoute[0].summary.totalTime / 60)
                  })}
                </div>
              )
            )}
            {/* Traffic + Weather quick-glance (PREMIUM) - VERTICAL STACK */}
            {travelInsights && !isOffline && (
              <div className="flex flex-col gap-1.5 mt-1.5 pt-1.5 border-t border-gray-200 dark:border-white/10 text-[9px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <img src="/context/Button icons/sun-svgrepo-com.svg" className="w-2.5 h-2.5 dark:invert opacity-70" alt="weather" />
                  <span className="text-gray-600 dark:text-white/80">{travelInsights.weatherDesc} • {travelInsights.temperature}°C</span>
                </div>
                {travelInsights.trafficCondition && (
                  <div className="flex items-center gap-2">
                    <img src="/context/Button icons/car-front-view-609-svgrepo-com.svg" className="w-2.5 h-2.5 dark:invert opacity-70" alt="traffic" />
                    <span className={travelInsights.trafficColor || 'text-green-600 dark:text-green-400'}>{travelInsights.trafficCondition}</span>
                  </div>
                )}
              </div>
            )}
            {/* Drag handle indicator */}
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-gray-400 rounded-full opacity-60 transition-opacity duration-200 hover:opacity-80"></div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Floating Shortcut Card - Pops in right under the Route Badge ✊🏽🇰🇪 */}
      <AnimatePresence>
        {selectedOffice && currentRoute && (
          <motion.div
            initial={{ opacity: 0, x: -20, y: routeBadgePosition.y + 120 }}
            animate={{
              opacity: 1,
              x: routeBadgePosition.x,
              y: routeBadgePosition.y + 120,
              scale: isDraggingRouteBadge ? 0.95 : 1
            }}
            exit={{ opacity: 0, scale: 0.8, x: -20 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              delay: 0.2 // Subtly pop in after the route badge
            }}
            className="fixed z-[1001] cursor-pointer active:scale-95 transition-transform"
            onClick={() => navigateToArea(selectedOffice)}
            title={`View more about ${selectedOffice.constituency_name || selectedOffice.county}`}
          >
            <div className={`px-4 py-3 rounded-2xl shadow-xl backdrop-blur-xl flex items-center space-x-3 border ${isDark
              ? 'bg-ios-blue-600/90 border-white/20 text-white'
              : 'bg-ios-blue/90 border-ios-blue/30 text-white'
              }`}>
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0 shadow-inner border border-white/10">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0 pr-1">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-0.5">Explore</span>
                <span className="text-sm font-black truncate max-w-[140px] leading-tight">
                  {selectedOffice.constituency_name || selectedOffice.county || 'This Area'}
                </span>
              </div>
              <div className="bg-white/10 rounded-lg p-1">
                <ChevronRight className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
            </div>
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
          liveOffices={viewportOffices}
        />

        {/* Viewport Bounds Listener */}
        <MapBoundsListener onBoundsChange={handleBoundsChange} />

        {/* Last Tap Location Indicator - ONLY WITH LOCATION ACCESS */}
        {hasLocationAccess && lastTapLocation && (
          <UserLocationMarker
            position={[lastTapLocation.lat, lastTapLocation.lng]}
            accuracy={100}
            color="#FF9500"
          />
        )}

        {/* Routing System - Conditional on Online Status */}
        {hasLocationAccess && !isOffline && userLocation && selectedOffice && (
          <RoutingSystem
            userLocation={userLocation}
            destination={selectedOffice}
            onRouteFound={handleRouteFound}
            onRouteError={handleRouteError}
            showAlternatives={false}
          />
        )}

        {/* Radius Circle — Uber-style search area visualisation */}
        {radiusCenter && (
          <RadiusCircle
            center={radiusCenter}
            radiusKm={radiusKm}
            animating={isRadiusAnimating}
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

      {/* Offline Route Downloader Sidebar */}
      <AnimatePresence>
        {showOfflineDownloader && hasLocationAccess && selectedOffice && (
          <OfflineRouteDownloader
            ref={offlineDownloaderRef}
            office={selectedOffice}
            userLocation={userLocation}
            currentRoute={currentRoute}
            routingError={routingError}
            travelInsights={travelInsights}
            trafficInfo={getTrafficInfo()}
            onClose={() => setShowOfflineDownloader(false)}
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
        travelInsights={travelInsights}
        state={bottomSheetState}
        onExpand={handleBottomSheetExpand}
        onCollapse={handleBottomSheetCollapse}
        onClose={handleBottomSheetClose}
        hasLocationAccess={hasLocationAccess}
        isDiaspora={isDiaspora}
      />
    </div>
  );
};

export default IEBCOfficeMap;
