// src/hooks/useUserLocation.js
import { useState, useCallback, useEffect } from 'react';

export const useUserLocation = (options = {}) => {
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permission, setPermission] = useState('prompt');

  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 60000, // 1 minute cache
    watch = false,
    onSuccess,
    onError
  } = options;

  // Check geolocation permission status
  const checkPermission = useCallback(async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      return 'prompt';
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setPermission(result.state);
      
      result.onchange = () => {
        setPermission(result.state);
      };
      
      return result.state;
    } catch (err) {
      console.warn('Permission API not supported:', err);
      return 'prompt';
    }
  }, []);

  // Get current position
  const getCurrentPosition = useCallback(async (overrideOptions = {}) => {
    setIsLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error('Geolocation is not supported by this browser');
        setError(error);
        setIsLoading(false);
        if (onError) onError(error);
        reject(error);
        return;
      }

      const finalOptions = {
        enableHighAccuracy,
        timeout,
        maximumAge,
        ...overrideOptions
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          };

          console.log('Location acquired:', locationData);
          setUserLocation(locationData);
          setError(null);
          setIsLoading(false);

          if (onSuccess) {
            onSuccess(locationData);
          }

          resolve(locationData);
        },
        (error) => {
          let errorMessage;
          let errorType = 'UNKNOWN_ERROR';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
              errorType = 'PERMISSION_DENIED';
              setPermission('denied');
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable. Please check your GPS connection.';
              errorType = 'POSITION_UNAVAILABLE';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              errorType = 'TIMEOUT';
              break;
            default:
              errorMessage = 'An unknown error occurred while getting your location.';
          }

          const enhancedError = new Error(errorMessage);
          enhancedError.type = errorType;
          enhancedError.code = error.code;

          console.error('Geolocation error:', enhancedError);
          setError(enhancedError);
          setIsLoading(false);

          if (onError) {
            onError(enhancedError);
          }

          reject(enhancedError);
        },
        finalOptions
      );
    });
  }, [enableHighAccuracy, timeout, maximumAge, onSuccess, onError]);

  // Request location permission
  const requestPermission = useCallback(async () => {
    try {
      await checkPermission();
      await getCurrentPosition({ maximumAge: 0 }); // Force fresh location
    } catch (err) {
      console.error('Permission request failed:', err);
      throw err;
    }
  }, [checkPermission, getCurrentPosition]);

  // Watch position for continuous updates
  const watchPosition = useCallback((watchOptions = {}) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return () => {};
    }

    const finalOptions = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 10000,
      ...watchOptions
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp
        };

        console.log('Location updated:', locationData);
        setUserLocation(locationData);
        setError(null);

        if (onSuccess) {
          onSuccess(locationData);
        }
      },
      (error) => {
        let errorMessage;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location tracking denied';
            setPermission('denied');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location tracking timeout';
            break;
          default:
            errorMessage = 'Location tracking error';
        }
        
        const enhancedError = new Error(errorMessage);
        enhancedError.type = 'WATCH_ERROR';
        setError(enhancedError);

        if (onError) {
          onError(enhancedError);
        }
      },
      finalOptions
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [onSuccess, onError]);

  // Get location with retry logic
  const getLocationWithRetry = useCallback(async (maxRetries = 3, retryDelay = 1000) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Location attempt ${attempt}/${maxRetries}`);
        const location = await getCurrentPosition({
          timeout: timeout * attempt, // Increase timeout with each attempt
          maximumAge: 0 // Always get fresh location
        });
        return location;
      } catch (err) {
        lastError = err;
        console.warn(`Location attempt ${attempt} failed:`, err);
        
        if (attempt < maxRetries) {
          console.log(`Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }
    
    throw lastError;
  }, [getCurrentPosition, timeout]);

  // Get approximate location from IP as fallback
  const getApproximateLocation = useCallback(async () => {
    try {
      console.log('Attempting to get approximate location from IP...');
      
      // Using a free IP geolocation service (you might want to use a more reliable service)
      const response = await fetch('https://ipapi.co/json/');
      
      if (!response.ok) {
        throw new Error('IP geolocation service unavailable');
      }
      
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        const approximateLocation = {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 50000, // IP-based location has low accuracy (~50km)
          city: data.city,
          country: data.country_name,
          source: 'ip_geolocation'
        };
        
        console.log('Approximate location from IP:', approximateLocation);
        return approximateLocation;
      }
      
      throw new Error('No location data from IP');
    } catch (err) {
      console.error('IP geolocation failed:', err);
      
      // Fallback to Kenya center coordinates
      return {
        latitude: -1.286389,
        longitude: 36.817223,
        accuracy: 100000, // Very low accuracy
        city: 'Nairobi',
        country: 'Kenya',
        source: 'default_fallback'
      };
    }
  }, []);

  // Initialize location on mount
  useEffect(() => {
    let isMounted = true;

    const initializeLocation = async () => {
      try {
        await checkPermission();
        
        // Only auto-fetch if permission is granted
        if (permission === 'granted') {
          console.log('Auto-fetching user location...');
          await getCurrentPosition();
        }
      } catch (err) {
        if (isMounted) {
          console.log('Auto-location fetch failed, will use manual trigger:', err.message);
        }
      }
    };

    initializeLocation();

    return () => {
      isMounted = false;
    };
  }, [checkPermission, getCurrentPosition, permission]);

  // Watch position if enabled
  useEffect(() => {
    if (!watch) return;

    const cleanup = watchPosition();
    return cleanup;
  }, [watch, watchPosition]);

  return {
    // State
    userLocation,
    isLoading,
    error,
    permission,
    
    // Actions
    getCurrentPosition,
    getLocationWithRetry,
    requestPermission,
    watchPosition,
    getApproximateLocation,
    checkPermission,
    
    // Derived state
    hasLocation: !!userLocation,
    isPermissionGranted: permission === 'granted',
    isPermissionDenied: permission === 'denied'
  };
};

export default useUserLocation;
