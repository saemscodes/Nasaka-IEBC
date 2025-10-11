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
  // Guard: only proceed when both have valid numeric coordinates
  if (
    !userLocation ||
    !destination ||
    typeof userLocation.latitude !== 'number' ||
    typeof userLocation.longitude !== 'number' ||
    typeof destination.latitude !== 'number' ||
    typeof destination.longitude !== 'number'
  ) {
    clearRoute();
    previousRouteRef.current = null;
    return;
  }

  const startLatLng = L.latLng(userLocation.latitude, userLocation.longitude);
  const destLatLng = L.latLng(destination.latitude, destination.longitude);

  const currentWaypoints = `${startLatLng.lat},${startLatLng.lng}-${destLatLng.lat},${destLatLng.lng}`;
  if (previousRouteRef.current === currentWaypoints) return;

  previousRouteRef.current = currentWaypoints;
  console.log('Creating route from:', startLatLng, 'to:', destLatLng);

  const control = createOrUpdateRoute(startLatLng, destLatLng, {
    onRouteFound: (routes) => {
      console.log('Route calculation successful:', routes?.length, 'routes found');
      onRouteFound?.(routes);
    },
    onRouteError: (error) => {
      console.error('Routing error:', error);
      onRouteError?.(error);
      console.warn('Routing failed:', error?.message || 'Unknown routing error');
    }
  });

  if (!control) {
    console.warn('Failed to create routing control - user will need to use fallback navigation');
    onRouteError?.(new Error('Routing service temporarily unavailable'));
  }

  return () => {
    clearRoute();
    previousRouteRef.current = null;
  };
}, [
  userLocation,
  destination,
  createOrUpdateRoute,
  clearRoute,
  onRouteFound,
  onRouteError,
  showAlternatives
]);

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
