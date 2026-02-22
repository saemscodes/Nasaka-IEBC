// src/hooks/useRoutingControl.js
import { useRef, useEffect, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

export default function useRoutingControl(map, opts = {}) {
  const routingControlRef = useRef(null);
  const routerRef = useRef(null);

  useEffect(() => {
    return () => {
      // Clean up on unmount
      if (routingControlRef.current) {
        try {
          routingControlRef.current.remove();
        } catch (e) {
          console.warn('Error removing routing control:', e);
        }
        routingControlRef.current = null;
      }
      routerRef.current = null;
    };
  }, []);

  const ensureRouter = useCallback((serviceUrl) => {
    if (routerRef.current) return routerRef.current;

    // Guard: ensure plugin exists
    if (!L.Routing || typeof L.Routing.osrmv1 !== 'function') {
      console.error('Routing plugin unavailable:', L.Routing);
      return null;
    }

    try {
      routerRef.current = L.Routing.osrmv1({
        serviceUrl: serviceUrl || opts.serviceUrl || 'https://router.project-osrm.org/route/v1'
      });
      return routerRef.current;
    } catch (err) {
      console.error('Failed creating router:', err);
      return null;
    }
  }, [opts.serviceUrl]);

  const createOrUpdateRoute = useCallback((startLatLng, destLatLng, { serviceUrl, onRouteFound, onRouteError } = {}) => {
    if (!map) {
      console.warn('Map not ready — cannot create route');
      return null;
    }

    // Ensure plugin exists
    if (!L.Routing || typeof L.Routing.control !== 'function') {
      console.error('Routing plugin missing at call time', L.Routing);
      if (onRouteError) onRouteError(new Error('Routing plugin not available'));
      return null;
    }

    const router = ensureRouter(serviceUrl);
    if (!router) {
      console.warn('Router not available');
      if (onRouteError) onRouteError(new Error('Routing service unavailable'));
      return null;
    }

    // If control already exists, simply update waypoints
    if (routingControlRef.current) {
      try {
        routingControlRef.current.setWaypoints([startLatLng, destLatLng]);
        return routingControlRef.current;
      } catch (err) {
        console.error('Failed to set waypoints on existing routing control:', err);
        // Attempt to remove and recreate
        try {
          routingControlRef.current.remove();
        } catch (e) { }
        routingControlRef.current = null;
      }
    }

    // Create deterministic options object
    const options = {
      waypoints: [startLatLng, destLatLng],
      router,
      routeWhileDragging: false, // Explicit boolean to avoid undefined error
      fitSelectedRoutes: true,
      showAlternatives: false,
      addWaypoints: false,
      draggableWaypoints: false,
      createMarker: (i, wp) => {
        const markerOptions = { draggable: false };
        if (i === 0) {
          // Start marker (user location)
          return L.marker(wp.latLng, {
            ...markerOptions,
            icon: L.divIcon({
              className: 'user-route-marker',
              html: `<div class="relative">
                      <div class="absolute inset-0 bg-ios-blue rounded-full animate-ping opacity-75"></div>
                      <div class="relative w-6 h-6 bg-ios-blue rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                        <div class="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          });
        } else {
          // Destination marker (IEBC office)
          return L.marker(wp.latLng, {
            ...markerOptions,
            icon: L.divIcon({
              className: 'destination-route-marker',
              html: `<div class="relative">
                      <div class="w-6 h-6 bg-ios-red rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                    </div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          });
        }
      },
      lineOptions: {
        styles: [
          { color: 'black', opacity: 0.15, weight: 9 },
          { color: 'white', opacity: 0.8, weight: 6 },
          { color: '#007AFF', opacity: 1, weight: 4 }
        ]
      },
      altLineOptions: {
        styles: [
          { color: 'black', opacity: 0.15, weight: 9 },
          { color: 'white', opacity: 0.8, weight: 6 },
          { color: '#007AFF', opacity: 0.5, weight: 2 }
        ]
      }
    };

    try {
      const control = L.Routing.control(options);

      // ✅ RACE CONDITION FIX (Full Ham)
      // Fix for internal crash in leaflet-routing-machine when an OSRM request returns after unmount.
      // We monkey-patch _clearLines to safely check for this._map before proceeding.
      const originalClearLines = control._clearLines;
      if (typeof originalClearLines === 'function') {
        control._clearLines = function () {
          if (!this._map) {
            console.log('RoutingSystem: Suppressing _clearLines call on null map (unmount race prevented)');
            return;
          }
          return originalClearLines.apply(this, arguments);
        };
      }

      // Add event listeners with safety checks
      if (onRouteFound) {
        control.on('routesfound', function (e) {
          if (!routingControlRef.current || !map) return;
          onRouteFound(e.routes);
        });
      }

      if (onRouteError) {
        control.on('routingerror', function (e) {
          if (!routingControlRef.current || !map) return;
          onRouteError(e.error);
        });
      }

      control.addTo(map);
      control.hide(); // Hide the default control panel

      routingControlRef.current = control;
      return control;
    } catch (err) {
      console.error('Failed to create routing control:', err);
      if (onRouteError) onRouteError(err);
      return null;
    }
  }, [map, ensureRouter]);

  const clearRoute = useCallback(() => {
    if (routingControlRef.current) {
      try {
        const control = routingControlRef.current;
        // Check if the control is attached to a map before trying to remove it
        // This prevents the "this._map is null" error in Leaflet Routing Machine
        if (control.getMap && control.getMap()) {
          control.remove();
        } else if (control._map) {
          control.remove();
        }
      } catch (e) {
        console.warn('Error removing routing control:', e);
      }
      routingControlRef.current = null;
    }
  }, []);

  return { createOrUpdateRoute, clearRoute, routingControlRef };
}
