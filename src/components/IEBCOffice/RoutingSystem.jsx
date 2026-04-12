// src/components/IEBCOffice/RoutingSystem.jsx
import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import useRoutingControl from '@/hooks/useRoutingControl';
import { toast } from 'sonner';

// Helper: Haversine distance in km
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

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

    // GEOGRAPHIC GUARD: Prevent OSRM 400 errors for cross-continental routing
    const distanceKm = getDistance(
      userLocation.latitude,
      userLocation.longitude,
      destination.latitude,
      destination.longitude
    );

    if (distanceKm > 2000) {
      // Region-aware toast messages based on distance from Kenya
      let toastTitle, toastDescription;

      if (distanceKm <= 5000) {
        // East Africa / Horn of Africa / Southern Africa
        toastTitle = "Turn-by-turn directions adjusted";
        toastDescription = "You appear to be in the East African region. Road routing across borders is limited. If you're in Kenya, check your GPS or VPN settings.";
      } else if (distanceKm <= 10000) {
        // Rest of Africa, Middle East, Europe, South/Central Asia
        toastTitle = "Turn-by-turn directions disabled";
        toastDescription = "You're accessing Nasaka from outside East Africa. Diaspora registration centres exist in your region — tap a Diaspora marker for embassy contact details.";
      } else {
        // Americas, East Asia, Oceania, Pacific
        toastTitle = "Turn-by-turn directions disabled";
        toastDescription = "You're accessing Nasaka from overseas. Switch to Diaspora mode to find Kenyan missions and registration centres in your region.";
      }

      toast.info(toastTitle, {
        description: toastDescription,
        duration: 10000,
        action: {
          label: "I'm Overseas",
          onClick: () => { }
        }
      });
      clearRoute();
      previousRouteRef.current = currentWaypoints; // Prevent repeated toasts
      return;
    }

    previousRouteRef.current = currentWaypoints;
    // Log removed for production


    const control = createOrUpdateRoute(startLatLng, destLatLng, {
      onRouteFound: (routes) => {
        // Log removed for production

        onRouteFound?.(routes);
      },
      onRouteError: (error) => {
        // Log removed for production

      }
    });

    if (!control) {
      // Log removed for production

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
