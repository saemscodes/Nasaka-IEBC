// src/components/IEBCOffice/RoutingSystem.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';

const RoutingSystem = ({ 
  userLocation, 
  destination, 
  onRouteFound, 
  onRouteError, 
  showAlternatives = false 
}) => {
  const map = useMap();
  const routingControlRef = useRef(null);
  const routeCalculationRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Enhanced error handling for routing
  const handleRouteError = useCallback((error) => {
    console.warn('Routing error:', error);
    
    // Provide fallback options
    const fallbackMessage = 'Routing service temporarily unavailable. Use Google Maps for directions.';
    
    if (onRouteError) {
      onRouteError({
        message: fallbackMessage,
        originalError: error,
        fallbackUrl: destination && destination.latitude && destination.longitude 
          ? `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`
          : null
      });
    }
  }, [onRouteError, destination]);

  // Clean up routing control safely
  const cleanupRouting = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (routeCalculationRef.current) {
      clearTimeout(routeCalculationRef.current);
      routeCalculationRef.current = null;
    }

    if (routingControlRef.current) {
      try {
        // Safely remove routing control
        if (map && map.hasControl(routingControlRef.current)) {
          map.removeControl(routingControlRef.current);
        }
        routingControlRef.current = null;
      } catch (error) {
        console.warn('Error cleaning up routing control:', error);
      }
    }
  }, [map]);

  // Initialize routing control
  const initializeRouting = useCallback(() => {
    if (!userLocation || !destination) return;
    if (!userLocation.latitude || !userLocation.longitude) return;
    if (!destination.latitude || !destination.longitude) return;

    // Clean up any existing routing
    cleanupRouting();

    // Use AbortController to handle component unmounting
    abortControllerRef.current = new AbortController();

    try {
      const start = L.latLng(userLocation.latitude, userLocation.longitude);
      const end = L.latLng(destination.latitude, destination.longitude);

      // Configure routing with error handling
      const routingControl = L.Routing.control({
        waypoints: [start, end],
        routeWhileDragging: false,
        showAlternatives: showAlternatives,
        fitSelectedRoutes: false, // Disable auto-fit to prevent conflicts
        show: false,
        createMarker: function() { return null; }, // No default markers
        lineOptions: {
          styles: [{ 
            color: '#007AFF', 
            weight: 6, 
            opacity: 0.8,
            className: 'custom-route-line'
          }],
          missingRouteTolerance: 0,
          extendToWaypoints: false,
          addWaypoints: false
        },
        // Use a more reliable routing service with fallback
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          timeout: 10000, // 10 second timeout
          profile: 'driving'
        }),
        // Alternative routing service configuration
        altLineOptions: {
          styles: [
            { color: '#34C759', weight: 4, opacity: 0.6 },
            { color: '#FF9500', weight: 4, opacity: 0.6 }
          ]
        }
      });

      // Add to map with error handling
      if (map) {
        routingControl.addTo(map);
        routingControlRef.current = routingControl;

        // Handle successful route calculation
        routingControl.on('routesfound', function(e) {
          if (abortControllerRef.current?.signal.aborted) return;
          
          const routes = e.routes;
          console.log(`Route calculation successful: ${routes.length} routes found`);
          
          if (onRouteFound) {
            onRouteFound(routes);
          }

          // Auto-fit to route if it's not too long (avoid zooming out too much)
          if (routes.length > 0 && routes[0].summary) {
            const totalDistance = routes[0].summary.totalDistance;
            if (totalDistance < 50000) { // Only auto-fit for routes < 50km
              routeCalculationRef.current = setTimeout(() => {
                if (map && !abortControllerRef.current?.signal.aborted) {
                  map.fitBounds(routingControl.getRoutes()[0].coordinates, {
                    padding: [20, 20],
                    maxZoom: 13
                  });
                }
              }, 500);
            }
          }
        });

        // Handle routing errors gracefully
        routingControl.on('routingerror', function(e) {
          if (abortControllerRef.current?.signal.aborted) return;
          
          console.error('Routing error:', e.error);
          handleRouteError(e.error);
        });

        // Handle waypoint errors
        routingControl.on('waypointserror', function(e) {
          if (abortControllerRef.current?.signal.aborted) return;
          
          console.warn('Waypoints error:', e);
          handleRouteError(new Error('Invalid start or destination location'));
        });
      }

    } catch (error) {
      console.error('Error initializing routing:', error);
      handleRouteError(error);
    }
  }, [userLocation, destination, showAlternatives, map, onRouteFound, handleRouteError, cleanupRouting]);

  // Effect to handle routing initialization and cleanup
  useEffect(() => {
    // Debounce route calculation to prevent rapid re-renders
    routeCalculationRef.current = setTimeout(() => {
      if (userLocation && destination) {
        initializeRouting();
      } else {
        cleanupRouting();
      }
    }, 300);

    return () => {
      cleanupRouting();
    };
  }, [userLocation, destination, initializeRouting, cleanupRouting]);

  // Additional cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRouting();
    };
  }, [cleanupRouting]);

  return null;
};

export default RoutingSystem;
