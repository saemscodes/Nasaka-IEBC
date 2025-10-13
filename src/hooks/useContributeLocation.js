import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useContributeLocation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Get current position with high accuracy
  const getCurrentPosition = useCallback((options = {}) => {
    const defaultOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000
    };

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          });
        },
        (error) => {
          let errorMessage = 'Unable to retrieve your location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }
          reject(new Error(errorMessage));
        },
        { ...defaultOptions, ...options }
      );
    });
  }, []);

  // Convert image to WebP format
  const convertImageToWebP = useCallback(async (file, maxWidth = 1600, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image on canvas (this strips EXIF data)
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Image conversion failed'));
            return;
          }
          const webpFile = new File([blob], `${crypto.randomUUID()}.webp`, {
            type: 'image/webp'
          });
          resolve(webpFile);
        }, 'image/webp', quality);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Find nearby landmarks/offices for triangulation
  const findNearbyLandmarks = useCallback(async (latitude, longitude, radiusMeters = 500) => {
    try {
      const { data: nearbyOffices, error } = await supabase
        .rpc('find_nearby_offices', {
          lat: latitude,
          lon: longitude,
          radius: radiusMeters
        });

      if (error) throw error;

      return nearbyOffices?.map(office => ({
        id: office.id,
        name: office.office_location,
        latitude: office.latitude,
        longitude: office.longitude,
        distance_m: office.distance,
        type: 'office'
      })) || [];
    } catch (error) {
      console.error('Error finding nearby landmarks:', error);
      return [];
    }
  }, []);

  // Calculate weighted average position for triangulation
  const calculateWeightedPosition = useCallback((points) => {
    if (!points || points.length === 0) return null;

    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;

    points.forEach(point => {
      // Higher accuracy (lower value) = higher weight
      const weight = point.accuracy && point.accuracy > 0 ? 
        1 / (point.accuracy * point.accuracy) : 1;
      
      totalWeight += weight;
      weightedLat += point.latitude * weight;
      weightedLng += point.longitude * weight;
    });

    return {
      latitude: weightedLat / totalWeight,
      longitude: weightedLng / totalWeight,
      totalWeight,
      pointsUsed: points.length
    };
  }, []);

  // Upload image to Supabase storage
  const uploadImageToStorage = useCallback(async (file) => {
    const fileExt = 'webp';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `map-data/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('map-data')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('map-data')
      .getPublicUrl(filePath);

    return {
      path: uploadData.path,
      publicUrl
    };
  }, []);

  // Submit contribution
  const submitContribution = useCallback(async (contributionData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      let imageUploadResult = null;

      // Upload image if provided
      if (contributionData.imageFile) {
        imageUploadResult = await uploadImageToStorage(contributionData.imageFile);
      }

      // Prepare device metadata (without PII)
      const deviceMeta = {
        accuracy: contributionData.accuracy,
        altitude: contributionData.altitude,
        altitudeAccuracy: contributionData.altitudeAccuracy,
        heading: contributionData.heading,
        speed: contributionData.speed,
        timestamp: contributionData.timestamp,
        userAgent: navigator.userAgent,
        platform: navigator.platform
      };

      // Insert contribution record
      const { data, error: insertError } = await supabase
        .from('iebc_office_contributions')
        .insert([{
          original_office_id: contributionData.officeId,
          submitted_county: contributionData.county,
          submitted_constituency_code: contributionData.constituencyCode,
          submitted_constituency: contributionData.constituency,
          submitted_office_location: contributionData.officeLocation,
          submitted_landmark: contributionData.landmark,
          submitted_latitude: contributionData.latitude,
          submitted_longitude: contributionData.longitude,
          submitted_accuracy_meters: contributionData.accuracy,
          device_metadata: deviceMeta,
          nearby_landmarks: contributionData.nearbyLandmarks,
          image_path: imageUploadResult?.path,
          image_public_url: imageUploadResult?.publicUrl,
          status: 'pending'
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [uploadImageToStorage]);

  return {
    getCurrentPosition,
    convertImageToWebP,
    findNearbyLandmarks,
    calculateWeightedPosition,
    submitContribution,
    isSubmitting,
    error
  };
};
