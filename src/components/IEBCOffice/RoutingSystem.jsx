import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';

const RoutingSystem = ({ 
  userLocation, 
  destination, 
  onRouteFound,
  onRouteError,
  showAlternatives = true 
}) => {
  const routingControlRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    // Initialize routing control when component mounts
    if (window.L && !routingControlRef.current) {
      // Create a custom routing control with better styling
      const RoutingControl = L.Routing.Control.extend({
        options: {
          waypoints: [],
          routeWhileDragging: false,
          showAlternatives: showAlternatives,
          altLineOptions: {
            styles: [
              { color: 'black', opacity: 0.15, weight: 9 },
              { color: 'white', opacity: 0.8, weight: 6 },
              { color: '#007AFF', opacity: 0.5, weight: 2 }
            ]
          },
          lineOptions: {
            styles: [
              { color: 'black', opacity: 0.15, weight: 9 },
              { color: 'white', opacity: 0.8, weight: 6 },
              { color: '#007AFF', opacity: 1, weight: 4 }
            ]
          },
          autoRoute: true,
          fitSelectedRoutes: true,
          show: false,
          addWaypoints: false,
          routeDragInterval: 100,
          createMarker: function(i, waypoint, n) {
            // Custom markers for start and end points
            const markerOptions = {
              draggable: false
            };

            if (i === 0) {
              // Start marker (user location)
              return L.marker(waypoint.latLng, {
                ...markerOptions,
                icon: L.divIcon({
                  className: 'user-route-marker',
                  html: `
                    <div class="relative">
                      <div class="absolute inset-0 bg-ios-blue rounded-full animate-ping opacity-75"></div>
                      <div class="relative w-6 h-6 bg-ios-blue rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                        <div class="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                  `,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })
              });
            } else {
              // Destination marker (IEBC office)
              return L.marker(waypoint.latLng, {
                ...markerOptions,
                icon: L.divIcon({
                  className: 'destination-route-marker',
                  html: `
                    <div class="relative">
                      <div class="w-6 h-6 bg-ios-red rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                    </div>
                  `,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })
              });
            }
          }
        }
      });

      routingControlRef.current = new RoutingControl();
    }
  }, [showAlternatives]);

  useEffect(() => {
    if (!userLocation || !destination) {
      // Remove routing control if no destination
      if (routingControlRef.current && mapRef.current) {
        mapRef.current.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
      return;
    }

    // Set waypoints for routing
    const waypoints = [
      L.latLng(userLocation.latitude, userLocation.longitude),
      L.latLng(destination.latitude, destination.longitude)
    ];

    if (routingControlRef.current) {
      routingControlRef.current.setWaypoints(waypoints);
      
      // Listen for route events
      routingControlRef.current.on('routesfound', function(e) {
        const routes = e.routes;
        if (onRouteFound) {
          onRouteFound(routes);
        }
        
        // Calculate route statistics
        routes.forEach((route, index) => {
          const distanceKm = (route.summary.totalDistance / 1000).toFixed(1);
          const timeMinutes = Math.round(route.summary.totalTime / 60);
          
          console.log(`Route ${index + 1}: ${distanceKm} km, ${timeMinutes} min`);
        });
      });

      routingControlRef.current.on('routingerror', function(e) {
        console.error('Routing error:', e.error);
        if (onRouteError) {
          onRouteError(e.error);
        }
      });

      // Add to map if not already added
      if (mapRef.current && !mapRef.current.hasControl(routingControlRef.current)) {
        routingControlRef.current.addTo(mapRef.current);
        routingControlRef.current.hide(); // Hide the default control panel
      }
    }

    return () => {
      // Cleanup on unmount or when route changes
      if (routingControlRef.current && mapRef.current) {
        mapRef.current.removeControl(routingControlRef.current);
      }
    };
  }, [userLocation, destination, onRouteFound, onRouteError]);

  // Function to set the map instance
  const setMap = (map) => {
    mapRef.current = map;
  };

  return null;
};

export default RoutingSystem;
