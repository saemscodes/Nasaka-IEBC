import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp?: number;
}

export const useLocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Request Android location permissions
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      // iOS permission handling
      try {
        // @ts-ignore - for web compatibility
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'granted') {
          setPermissionGranted(true);
          return true;
        } else if (permission.state === 'prompt') {
          // Request permission
          return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              () => {
                setPermissionGranted(true);
                resolve(true);
              },
              () => {
                setPermissionGranted(false);
                resolve(false);
              }
            );
          });
        } else {
          setPermissionGranted(false);
          return false;
        }
      } catch (err) {
        console.warn('iOS location permission error:', err);
        return false;
      }
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission Required',
            message: 'CEKA NASAKA IEBC Office Finder needs access to your location to find nearby IEBC offices and provide accurate directions for voter registration services.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        const backgroundGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          {
            title: 'Background Location Permission',
            message: 'CEKA NASAKA IEBC needs background location access to provide continuous navigation assistance to IEBC offices for essential voter services.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );

        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        setPermissionGranted(isGranted);
        return isGranted;
      } catch (err) {
        console.warn('Android location permission error:', err);
        setPermissionGranted(false);
        return false;
      }
    }
    
    // Web platform - always return true as we'll handle permission in getCurrentLocation
    setPermissionGranted(true);
    return true;
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<Location | null> => {
    setLoading(true);
    setError(null);

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser.');
      }

      // Request permission if not already granted
      if (!permissionGranted) {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          throw new Error('Location permission denied. Please enable location access in your device settings to use IEBC office finder services.');
        }
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation: Location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp,
            };
            
            setLocation(newLocation);
            setLoading(false);
            setError(null);
            resolve(newLocation);
          },
          (err) => {
            let errorMessage = 'Failed to get your location. ';
            
            switch (err.code) {
              case err.PERMISSION_DENIED:
                errorMessage += 'Please enable location permissions in your browser or device settings to find nearby IEBC offices.';
                break;
              case err.POSITION_UNAVAILABLE:
                errorMessage += 'Location information is unavailable. Please check your GPS and network connection.';
                break;
              case err.TIMEOUT:
                errorMessage += 'Location request timed out. Please try again.';
                break;
              default:
                errorMessage += 'An unknown error occurred.';
                break;
            }
            
            setError(errorMessage);
            setLoading(false);
            resolve(null);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000,
          }
        );
      });
    } catch (err: any) {
      setError(err.message || 'Failed to access location services.');
      setLoading(false);
      return null;
    }
  }, [permissionGranted, requestLocationPermission]);

  // Auto-get location on mount if permission already granted
  useEffect(() => {
    const checkInitialPermission = async () => {
      try {
        // @ts-ignore - for web compatibility
        const permission = await navigator.permissions?.query({ name: 'geolocation' });
        if (permission?.state === 'granted') {
          setPermissionGranted(true);
          getCurrentLocation();
        }
      } catch (err) {
        // Permission API not available, continue silently
      }
    };

    checkInitialPermission();
  }, [getCurrentLocation]);

  return {
    location,
    error,
    loading,
    permissionGranted,
    getCurrentLocation,
    requestLocationPermission,
  };
};
