// src/hooks/useContributeLocation.js
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useContributeLocation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Get current position using browser geolocation
  const getCurrentPosition = useCallback(() => {
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
          let errorMessage;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
            default:
              errorMessage = 'An unknown error occurred while getting your location.';
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  }, []);

  // Find nearby IEBC offices/landmarks
  const findNearbyLandmarks = useCallback(async (latitude, longitude, radiusMeters = 1000) => {
    try {
      console.log('Searching for nearby landmarks...', { latitude, longitude, radiusMeters });

      // Query for nearby IEBC offices using PostGIS distance calculation
      const { data: offices, error: officesError } = await supabase
        .rpc('get_nearby_iebc_offices', {
          p_lat: latitude,
          p_lng: longitude,
          p_radius: radiusMeters
        });

      if (officesError) {
        console.error('Error fetching nearby offices:', officesError);
        
        // Fallback: query using client-side filtering if RPC is not available
        const { data: allOffices, error: fallbackError } = await supabase
          .from('iebc_offices')
          .select('*')
          .limit(50);

        if (fallbackError) {
          throw new Error(`Failed to fetch nearby offices: ${fallbackError.message}`);
        }

        // Client-side distance calculation
        const officesWithDistance = allOffices.map(office => {
          const distance = calculateDistance(
            latitude,
            longitude,
            office.latitude,
            office.longitude
          );
          return {
            ...office,
            distance_m: distance,
            distance_km: distance / 1000
          };
        }).filter(office => office.distance_m <= radiusMeters)
          .sort((a, b) => a.distance_m - b.distance_m)
          .slice(0, 5);

        return officesWithDistance;
      }

      return offices || [];
    } catch (err) {
      console.error('Error in findNearbyLandmarks:', err);
      throw new Error(`Failed to find nearby landmarks: ${err.message}`);
    }
  }, []);

  // Calculate weighted position using triangulation
  const calculateWeightedPosition = useCallback((points) => {
    if (!points || !Array.isArray(points) || points.length === 0) {
      console.warn('No points provided for weighted position calculation');
      return null;
    }

    try {
      let totalWeight = 0;
      let weightedLat = 0;
      let weightedLng = 0;

      points.forEach(point => {
        if (!point.latitude || !point.longitude) {
          console.warn('Invalid point in triangulation data:', point);
          return;
        }

        // Use inverse of accuracy as weight (higher accuracy = higher weight)
        const accuracy = point.accuracy || 50; // Default to 50m if accuracy not provided
        const weight = 1 / Math.max(accuracy, 1); // Avoid division by zero
        
        weightedLat += point.latitude * weight;
        weightedLng += point.longitude * weight;
        totalWeight += weight;
      });

      if (totalWeight === 0) {
        console.warn('Total weight is zero, using first point as fallback');
        return {
          latitude: points[0].latitude,
          longitude: points[0].longitude,
          accuracy: points[0].accuracy || 50
        };
      }

      const result = {
        latitude: weightedLat / totalWeight,
        longitude: weightedLng / totalWeight,
        accuracy: Math.min(...points.map(p => p.accuracy || 50)) // Use best accuracy
      };

      console.log('Weighted position calculated:', result);
      return result;

    } catch (err) {
      console.error('Error calculating weighted position:', err);
      return null;
    }
  }, []);

  // Convert image to WebP format for better compression
  const convertImageToWebP = useCallback((file, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        reject(new Error('Selected file is not an image'));
        return;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('Image must be smaller than 10MB'));
        return;
      }

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          const maxDimension = 2048;
          let { width, height } = img;

          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and convert to WebP
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to convert image to WebP'));
              return;
            }

            const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + '.webp', {
              type: 'image/webp',
              lastModified: new Date().getTime()
            });

            resolve(webpFile);
          }, 'image/webp', quality);

        } catch (err) {
          reject(new Error(`Image conversion failed: ${err.message}`));
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for conversion'));
      };

      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Submit contribution to database
  const submitContribution = useCallback(async (contributionData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Starting contribution submission process...', {
        latitude: contributionData.latitude,
        longitude: contributionData.longitude,
        hasImage: !!contributionData.imageFile,
        notesLength: contributionData.landmark?.length || 0
      });

      // Validate required data
      if (!contributionData.latitude || !contributionData.longitude) {
        throw new Error('Latitude and longitude are required for submission');
      }

      if (Math.abs(contributionData.latitude) > 90 || Math.abs(contributionData.longitude) > 180) {
        throw new Error('Invalid coordinates provided');
      }

      let imageUploadResult = null;

      // Upload image if provided
      if (contributionData.imageFile) {
        console.log('Uploading contribution image...');
        
        const fileExt = 'webp';
        const fileName = `contribution-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `map-contributions/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('map-data')
          .upload(filePath, contributionData.imageFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/webp'
          });

        if (uploadError) {
          console.error('Image upload failed:', uploadError);
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        // Get public URL for the uploaded image
        const { data: { publicUrl } } = supabase.storage
          .from('map-data')
          .getPublicUrl(filePath);

        imageUploadResult = {
          path: uploadData.path,
          publicUrl: publicUrl
        };
        
        console.log('Image uploaded successfully:', imageUploadResult);
      }

      // Prepare device metadata (anonymized)
      const deviceMeta = {
        accuracy: contributionData.accuracy || null,
        altitude: contributionData.altitude || null,
        altitudeAccuracy: contributionData.altitudeAccuracy || null,
        heading: contributionData.heading || null,
        speed: contributionData.speed || null,
        timestamp: contributionData.timestamp || Date.now(),
        userAgent: navigator.userAgent ? navigator.userAgent.substring(0, 100) : 'unknown',
        platform: navigator.platform || 'unknown',
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language || 'en',
        hasTouch: 'ontouchstart' in window,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      // Insert contribution record
      console.log('Inserting contribution into database...');
      
      const contributionPayload = {
        original_office_id: contributionData.officeId || null,
        submitted_county: contributionData.county || null,
        submitted_constituency_code: contributionData.constituencyCode || null,
        submitted_constituency: contributionData.constituency || null,
        submitted_office_location: contributionData.officeLocation || 'User Contributed Location',
        submitted_landmark: contributionData.landmark || null,
        submitted_latitude: contributionData.latitude,
        submitted_longitude: contributionData.longitude,
        submitted_accuracy_meters: contributionData.accuracy || null,
        device_metadata: deviceMeta,
        nearby_landmarks: contributionData.nearbyLandmarks || null,
        image_path: imageUploadResult?.path || null,
        image_public_url: imageUploadResult?.publicUrl || null,
        status: 'pending',
        submission_source: 'web_contribution',
        created_at: new Date().toISOString()
      };

      const { data, error: insertError } = await supabase
        .from('iebc_office_contributions')
        .insert([contributionPayload])
        .select(`
          id,
          submitted_office_location,
          submitted_county,
          submitted_constituency,
          submitted_latitude,
          submitted_longitude,
          status,
          created_at
        `)
        .single();

      if (insertError) {
        console.error('Database insertion failed:', insertError);
        throw new Error(`Failed to save contribution: ${insertError.message}`);
      }

      console.log('Contribution submitted successfully:', data);
      
      // Log successful submission for analytics
      console.log('Contribution Analytics:', {
        contributionId: data.id,
        location: `${data.submitted_latitude}, ${data.submitted_longitude}`,
        county: data.submitted_county,
        constituency: data.submitted_constituency,
        hasImage: !!imageUploadResult,
        timestamp: data.created_at
      });

      return data;

    } catch (err) {
      console.error('Contribution submission error:', err);
      const errorMessage = err.message || 'An unexpected error occurred during submission';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Helper function to calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return {
    // Core functions
    getCurrentPosition,
    findNearbyLandmarks,
    calculateWeightedPosition,
    convertImageToWebP,
    submitContribution,
    
    // State
    isSubmitting,
    error,
    
    // Helper functions (optional, for internal use but exposed if needed)
    calculateDistance
  };
};

export default useContributeLocation;
