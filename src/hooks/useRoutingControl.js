// src/hooks/useRoutingControl.js
import { useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

export const useRoutingControl = (map) => {
  const routingControlRef = useRef(null);
  const routerRef = useRef(null);

  // Initialize the OSRM router - IMPORTANT: Use your own server in production
  const initializeRouter = useCallback(() => {
    if (!routerRef.current) {
      routerRef.current = L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1/',
        // Add timeout to handle demo server limitations
        timeout: 10000
      });
    }
    return routerRef.current;
  }, []);

  // Create or update routing control
  const createOrUpdateRoute = useCallback((startLatLng, destLatLng) => {
    if (!map) {
      console.warn('Map not available for routing');
      return null;
    }

    // Safely check if routing plugin is available
    if (!L.Routing || typeof L.Routing.control !== 'function') {
      console.error('Leaflet Routing Machine plugin not properly loaded');
      return null;
    }

    const router = initializeRouter();

    // Clear existing route if any
    if (routingControlRef.current) {
      try {
        map.removeControl(routingControlRef.current);
      } catch (error) {
        console.warn('Error removing existing routing control:', error);
      }
      routingControlRef.current = null;
    }

    try {
      // Create new routing control with EXPLICIT options to avoid undefined errors
      const control = L.Routing.control({
        waypoints: [
          L.latLng(startLatLng.lat, startLatLng.lng),
          L.latLng(destLatLng.lat, destLatLng.lng)
        ],
        router: router,
        // Explicitly define all options to prevent "undefined" errors
        routeWhileDragging: false,
        showAlternatives: false,
        fitSelectedRoutes: true,
        show: false, // Hide the default itinerary
        lineOptions: {
          styles: [
            { 
              color: '#007AFF', 
              opacity: 0.8, 
              weight: 6,
              className: 'route-line'
            }
          ],
          extendToWaypoints: true,
          missingRouteTolerance: 1
        },
        createMarker: (i, waypoint) => {
          // Return null to use our custom markers instead
          return null;
        },
        addWaypoints: false,
        draggableWaypoints: false,
        // Alternative route styling
        altLineOptions: {
          styles: [
            { color: '#8E8E93', opacity: 0.6, weight: 4 }
          ]
        }
      });

      // Add to map and store reference
      control.addTo(map);
      routingControlRef.current = control;

      // Set up error handling for the routing control
      control.on('routingerror', (error) => {
        console.warn('Routing error:', error.error);
        // Fallback to Google Maps
        openGoogleMapsFallback(startLatLng, destLatLng);
      });

      control.on('routesfound', (e) => {
        console.log('Route found with', e.routes.length, 'alternatives');
      });

      return control;

    } catch (error) {
      console.error('Failed to create routing control:', error);
      // Fallback to Google Maps
      openGoogleMapsFallback(startLatLng, destLatLng);
      return null;
    }
  }, [map, initializeRouter]);

  // Clear route from map
  const clearRoute = useCallback(() => {
    if (routingControlRef.current && map) {
      try {
        map.removeControl(routingControlRef.current);
      } catch (error) {
        console.warn('Error clearing route:', error);
      }
      routingControlRef.current = null;
    }
  }, [map]);

  // Fallback to Google Maps
  const openGoogleMapsFallback = useCallback((start, dest) => {
    try {
      const origin = `${start.lat},${start.lng}`;
      const destination = `${dest.lat},${dest.lng}`;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to open Google Maps fallback:', error);
    }
  }, []);

  return {
    createOrUpdateRoute,
    clearRoute,
    openGoogleMapsFallback
  };
};
