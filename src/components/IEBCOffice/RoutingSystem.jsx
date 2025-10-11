// src/components/IEBCOffice/RoutingSystem.jsx
import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import useRoutingControl from '@/hooks/useRoutingControl';

const RoutingSystem = ({ 
  userLocation, 
  destination, 
  onRouteFound, 
  onRouteError, 
  showAlternatives = false 
}) => {
  const map = useMap();
  const { createOrUpdateRoute, clearRoute } = useRoutingControl(map);
  const previousRouteRef = useRef(null);

  useEffect(() => {
    if (!userLocation || !destination) {
      // Clear route if no destination
      clearRoute();
      previousRouteRef.current = null;
      return;
    }

    // Create route waypoints
    const startLatLng = L.latLng(userLocation.latitude, userLocation.longitude);
    const destLatLng = L.latLng(destination.latitude, destination.longitude);

    // Only create new route if waypoints changed
    const currentWaypoints = `${startLatLng.lat},${startLatLng.lng}-${destLatLng.lat},${destLatLng.lng}`;
    if (previousRouteRef.current === currentWaypoints) {
      return; // Skip if same route
    }

    previousRouteRef.current = currentWaypoints;

    console.log('Creating route from:', startLatLng, 'to:', destLatLng);

    // Create or update the route
    const control = createOrUpdateRoute(startLatLng, destLatLng, {
      onRouteFound: (routes) => {
        console.log('Route calculation successful:', routes?.length, 'routes found');
        if (onRouteFound) {
          onRouteFound(routes);
        }
      },
      onRouteError: (error) => {
        console.error('Routing error:', error);
        if (onRouteError) {
          onRouteError(error);
        }
        
        // Provide helpful error information
        const errorMessage = error?.message || 'Unknown routing error';
        console.warn('Routing failed. User can use Google Maps fallback. Error:', errorMessage);
      }
    });

    if (!control) {
      console.warn('Failed to create routing control - user will need to use fallback navigation');
      if (onRouteError) {
        onRouteError(new Error('Routing service temporarily unavailable'));
      }
    }

    return () => {
      // Cleanup when dependencies change
      if (control) {
        clearRoute();
        previousRouteRef.current = null;
      }
    };
  }, [userLocation, destination, createOrUpdateRoute, clearRoute, onRouteFound, onRouteError, showAlternatives]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRoute();
      previousRouteRef.current = null;
    };
  }, [clearRoute]);

  return null;
};

export default RoutingSystem;
