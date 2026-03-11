import React, { useState, useCallback } from 'react';

const KENYA_COUNTY_CENTERS = {
  'nairobi': { latitude: -1.2921, longitude: 36.8219 },
  'mombasa': { latitude: -4.0435, longitude: 39.6682 },
  'kisumu': { latitude: -0.0917, longitude: 34.7680 },
  'nakuru': { latitude: -0.3031, longitude: 36.0800 },
  'eldoret': { latitude: 0.5143, longitude: 35.2698 },
  'kiambu': { latitude: -1.1714, longitude: 36.8356 },
  'machakos': { latitude: -1.5177, longitude: 37.2634 },
  'nyeri': { latitude: -0.4197, longitude: 36.9511 },
  'uasin gishu': { latitude: 0.5143, longitude: 35.2698 },
  'kajiado': { latitude: -2.0981, longitude: 36.7820 },
  'kilifi': { latitude: -3.6305, longitude: 39.8499 },
  'nyandarua': { latitude: -0.1804, longitude: 36.5230 },
  'laikipia': { latitude: 0.3606, longitude: 36.7820 },
  'trans nzoia': { latitude: 1.0567, longitude: 34.9507 },
  'bungoma': { latitude: 0.5636, longitude: 34.5584 },
  'kakamega': { latitude: 0.2827, longitude: 34.7519 },
  'kericho': { latitude: -0.3692, longitude: 35.2863 },
  'bomet': { latitude: -0.7813, longitude: 35.3418 },
  'narok': { latitude: -1.0878, longitude: 35.8600 },
  'nandi': { latitude: 0.1836, longitude: 35.1269 },
  'baringo': { latitude: 0.4916, longitude: 35.9720 },
  'meru': { latitude: 0.0480, longitude: 37.6559 },
  'embu': { latitude: -0.5388, longitude: 37.4593 },
  'tharaka nithi': { latitude: -0.3041, longitude: 37.7200 },
  'kitui': { latitude: -1.3667, longitude: 38.0167 },
  'makueni': { latitude: -1.8000, longitude: 37.6167 },
  'kwale': { latitude: -4.1761, longitude: 39.4527 },
  'taita taveta': { latitude: -3.3167, longitude: 38.5500 },
  'tana river': { latitude: -1.7517, longitude: 40.0326 },
  'lamu': { latitude: -2.2696, longitude: 40.9020 },
  'garissa': { latitude: -0.4532, longitude: 39.6461 },
  'wajir': { latitude: 1.7471, longitude: 40.0573 },
  'mandera': { latitude: 3.9373, longitude: 41.8569 },
  'marsabit': { latitude: 2.3284, longitude: 37.9900 },
  'isiolo': { latitude: 0.3546, longitude: 37.5822 },
  'samburu': { latitude: 1.1748, longitude: 36.9541 },
  'turkana': { latitude: 3.1122, longitude: 35.5889 },
  'west pokot': { latitude: 1.6190, longitude: 35.1100 },
  'elgeyo marakwet': { latitude: 0.6740, longitude: 35.5083 },
  'vihiga': { latitude: 0.0839, longitude: 34.7076 },
  'busia': { latitude: 0.4608, longitude: 34.1108 },
  'siaya': { latitude: -0.0607, longitude: 34.2422 },
  'homa bay': { latitude: -0.5273, longitude: 34.4571 },
  'migori': { latitude: -1.0634, longitude: 34.4731 },
  'kisii': { latitude: -0.6817, longitude: 34.7667 },
  'nyamira': { latitude: -0.5669, longitude: 34.9345 },
  'murang\'a': { latitude: -0.7210, longitude: 37.1526 },
  'kirinyaga': { latitude: -0.4989, longitude: 37.2803 },
};

const KENYA_DEFAULT = { latitude: -0.0236, longitude: 37.9062 };

const fetchIPLocation = async () => {
  try {
    const response = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'ipapi', body: { ip: '' } })
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.country_code !== 'KE' || !data.latitude || !data.longitude) {
      const region = (data.region || '').toLowerCase();
      const city = (data.city || '').toLowerCase();

      const countyMatch =
        KENYA_COUNTY_CENTERS[city] ||
        KENYA_COUNTY_CENTERS[region] ||
        Object.entries(KENYA_COUNTY_CENTERS).find(
          ([key]) => region.includes(key) || city.includes(key)
        )?.[1];

      if (countyMatch) {
        return {
          latitude: countyMatch.latitude,
          longitude: countyMatch.longitude,
          accuracy: 50000,
          source: 'ip_county_fallback',
          region: data.region || 'Kenya',
          city: data.city || ''
        };
      }

      return {
        latitude: KENYA_DEFAULT.latitude,
        longitude: KENYA_DEFAULT.longitude,
        accuracy: 500000,
        source: 'ip_country_fallback',
        region: 'Kenya',
        city: ''
      };
    }

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: 25000,
      source: 'ip_geolocation',
      region: data.region || '',
      city: data.city || ''
    };
  } catch {
    return null;
  }
};

const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(null);

  const requestLocation = useCallback(() => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      fetchIPLocation().then((ipLoc) => {
        if (ipLoc) {
          setLocation({
            latitude: ipLoc.latitude,
            longitude: ipLoc.longitude,
            accuracy: ipLoc.accuracy,
            timestamp: Date.now()
          });
          setSource(ipLoc.source);
        } else {
          setError('Geolocation is not supported by your browser');
        }
        setLoading(false);
      });
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          if (!position || !position.coords) {
            throw new Error('Invalid position data received');
          }

          const { latitude, longitude, accuracy } = position.coords;

          if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
            throw new Error('Invalid coordinates received');
          }

          setLocation({
            latitude,
            longitude,
            accuracy: accuracy || 0,
            timestamp: position.timestamp || Date.now()
          });
          setSource('gps');
          setLoading(false);
          setError(null);
        } catch (processingError) {
          setError(processingError.message || 'Failed to process location data');
          setLoading(false);
        }
      },
      (err) => {
        let errorMessage = 'Unable to retrieve your location';
        let shouldFallbackToIP = false;

        if (!err) {
          shouldFallbackToIP = true;
        } else {
          switch (err.code) {
            case 1:
              errorMessage = 'Permission denied. Using approximate location from IP.';
              shouldFallbackToIP = true;
              break;
            case 2:
              errorMessage = 'Location information unavailable. Using approximate location from IP.';
              shouldFallbackToIP = true;
              break;
            case 3:
              errorMessage = 'Location request timed out. Using approximate location from IP.';
              shouldFallbackToIP = true;
              break;
            default:
              errorMessage = err.message || 'An unknown error occurred while getting your location';
              shouldFallbackToIP = true;
              break;
          }
        }

        if (shouldFallbackToIP) {
          fetchIPLocation().then((ipLoc) => {
            if (ipLoc) {
              setLocation({
                latitude: ipLoc.latitude,
                longitude: ipLoc.longitude,
                accuracy: ipLoc.accuracy,
                timestamp: Date.now()
              });
              setSource(ipLoc.source);
              setError(null);
            } else {
              setError(errorMessage);
            }
            setLoading(false);
          });
        } else {
          setError(errorMessage);
          setLoading(false);
        }
      },
      options
    );
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setError(null);
    setSource(null);
  }, []);

  return {
    location,
    error,
    loading,
    source,
    requestLocation,
    clearError,
    clearLocation
  };
};

export { useGeolocation };
