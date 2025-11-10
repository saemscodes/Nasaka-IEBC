import React, { useState, useCallback } from 'react';

const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(() => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation is not supported by your browser';
      setError(errorMsg);
      setLoading(false);
      console.error(errorMsg);
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
          setLoading(false);
          setError(null);
        } catch (processingError) {
          console.error('Error processing geolocation:', processingError);
          setError(processingError.message || 'Failed to process location data');
          setLoading(false);
        }
      },
      (err) => {
        let errorMessage = 'Unable to retrieve your location';
        
        if (!err) {
          console.error('Unknown geolocation error');
        } else {
          switch (err.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = 'Permission denied. Please allow location access in your browser settings.';
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = 'Location information unavailable. Please check your GPS or network connection.';
              break;
            case 3: // TIMEOUT
              errorMessage = 'Location request timed out. Please try again.';
              break;
            default:
              errorMessage = err.message || 'An unknown error occurred while getting your location';
              break;
          }
        }
        
        console.error('Geolocation error:', errorMessage, err);
        setError(errorMessage);
        setLoading(false);
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
  }, []);

  return { 
    location, 
    error, 
    loading, 
    requestLocation,
    clearError,
    clearLocation
  };
};

export { useGeolocation };
