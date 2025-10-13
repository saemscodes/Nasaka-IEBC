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

  // Enhanced: Find optimal triangulation landmarks
  const findOptimalTriangulationLandmarks = useCallback(async (latitude, longitude, radiusMeters = 2000) => {
    try {
      console.log('Searching for optimal triangulation landmarks...', { 
        latitude, 
        longitude, 
        radiusMeters 
      });

      // Query for optimal triangulation landmarks
      const { data: landmarks, error: landmarksError } = await supabase
        .rpc('get_optimal_triangulation_landmarks', {
          p_lat: latitude,
          p_lng: longitude,
          p_radius_meters: radiusMeters,
          p_max_landmarks: 8
        });

      if (landmarksError) {
        console.error('Error fetching triangulation landmarks:', landmarksError);
        
        // Fallback to basic IEBC offices query
        const { data: basicLandmarks, error: fallbackError } = await supabase
          .from('iebc_offices')
          .select('*')
          .eq('verified', true)
          .limit(20);

        if (fallbackError) {
          throw new Error(`Failed to fetch landmarks: ${fallbackError.message}`);
        }

        // Enhanced client-side processing with bearing calculation
        const landmarksWithMetadata = basicLandmarks.map(landmark => {
          const distance = calculateDistance(
            latitude,
            longitude,
            landmark.verified_latitude || landmark.latitude,
            landmark.verified_longitude || landmark.longitude
          );
          
          const bearing = calculateBearing(
            latitude,
            longitude,
            landmark.verified_latitude || landmark.latitude,
            landmark.verified_longitude || landmark.longitude
          );

          const qualityScore = calculateLandmarkQuality(landmark, distance, radiusMeters);

          return {
            ...landmark,
            distance_m: distance,
            distance_km: distance / 1000,
            bearing_degrees: bearing,
            quality_score: qualityScore,
            direction_description: getDirectionFromBearing(bearing),
            side_of_road: determineSideOfRoad(latitude, landmark.verified_latitude || landmark.latitude)
          };
        })
        .filter(landmark => landmark.distance_m <= radiusMeters)
        .sort((a, b) => b.quality_score - a.quality_score)
        .slice(0, 6);

        return landmarksWithMetadata;
      }

      console.log('Found triangulation landmarks:', landmarks);
      return landmarks || [];

    } catch (err) {
      console.error('Error in findOptimalTriangulationLandmarks:', err);
      throw new Error(`Failed to find triangulation landmarks: ${err.message}`);
    }
  }, []);

  // Enhanced triangulation with vector-based weighted average
  const calculateEnhancedTriangulation = useCallback((userPosition, landmarks) => {
    if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 3) {
      console.warn('Insufficient landmarks for enhanced triangulation');
      return userPosition; // Fallback to raw GPS
    }

    try {
      console.log('Performing enhanced triangulation with', landmarks.length, 'landmarks');

      // Select optimal landmarks for triangulation (best quality and distribution)
      const optimalLandmarks = selectOptimalTriangulationSet(landmarks);
      
      if (optimalLandmarks.length < 3) {
        console.warn('Not enough optimal landmarks, using basic weighted average');
        return calculateWeightedPosition([userPosition, ...landmarks.slice(0, 2)]);
      }

      // Method 1: Vector-based triangulation
      const vectorResult = vectorBasedTriangulation(userPosition, optimalLandmarks);
      
      // Method 2: Quality-weighted centroid
      const centroidResult = calculateQualityWeightedCentroid(optimalLandmarks);
      
      // Method 3: GPS accuracy weighted position (fallback)
      const gpsWeightedResult = calculateWeightedPosition([userPosition]);

      // Combine results based on confidence
      const finalResult = combineTriangulationMethods(
        vectorResult, 
        centroidResult, 
        gpsWeightedResult, 
        optimalLandmarks
      );

      console.log('Enhanced triangulation result:', {
        inputGPS: userPosition,
        vectorResult,
        centroidResult,
        gpsWeightedResult,
        finalResult,
        landmarksUsed: optimalLandmarks.length
      });

      return finalResult;

    } catch (err) {
      console.error('Error in enhanced triangulation:', err);
      return calculateWeightedPosition([userPosition, ...landmarks.slice(0, 2)]);
    }
  }, []);

  // Vector-based triangulation using bearing intersections
  const vectorBasedTriangulation = useCallback((userPosition, landmarks) => {
    const vectors = landmarks.map(landmark => ({
      fromLat: landmark.latitude,
      fromLng: landmark.longitude,
      toLat: userPosition.latitude,
      toLng: userPosition.longitude,
      bearing: landmark.bearing_degrees,
      distance: landmark.distance_meters,
      quality: landmark.quality_score || 0.7,
      accuracy: landmark.typical_accuracy_meters || 15
    }));

    // Calculate intersection points between vectors
    const intersectionPoints = [];
    
    for (let i = 0; i < vectors.length - 1; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        const intersection = calculateVectorIntersection(vectors[i], vectors[j]);
        if (intersection && isValidCoordinate(intersection.lat, intersection.lng)) {
          intersectionPoints.push({
            ...intersection,
            weight: (vectors[i].quality + vectors[j].quality) / 2,
            sources: [i, j]
          });
        }
      }
    }

    if (intersectionPoints.length === 0) {
      return userPosition;
    }

    // Calculate weighted centroid of intersection points
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;

    intersectionPoints.forEach(point => {
      weightedLat += point.lat * point.weight;
      weightedLng += point.lng * point.weight;
      totalWeight += point.weight;
    });

    const resultLat = weightedLat / totalWeight;
    const resultLng = weightedLng / totalWeight;

    // Calculate confidence based on intersection consistency
    const avgDistanceFromCentroid = intersectionPoints.reduce((sum, point) => {
      return sum + calculateDistance(resultLat, resultLng, point.lat, point.lng);
    }, 0) / intersectionPoints.length;

    const confidence = Math.max(0, 1 - (avgDistanceFromCentroid / 100)); // Normalize confidence

    return {
      latitude: resultLat,
      longitude: resultLng,
      accuracy: Math.min(userPosition.accuracy || 50, avgDistanceFromCentroid * 2),
      confidence: confidence,
      method: 'vector_triangulation',
      landmarks_used: landmarks.length,
      intersections_calculated: intersectionPoints.length
    };
  }, []);

  // Calculate intersection point of two vectors
  const calculateVectorIntersection = useCallback((vector1, vector2) => {
    try {
      // Convert bearings to radians
      const bearing1 = (vector1.bearing * Math.PI) / 180;
      const bearing2 = (vector2.bearing * Math.PI) / 180;

      // Calculate intersection using spherical geometry
      const lat1 = (vector1.fromLat * Math.PI) / 180;
      const lng1 = (vector1.fromLng * Math.PI) / 180;
      const lat2 = (vector2.fromLat * Math.PI) / 180;
      const lng2 = (vector2.fromLng * Math.PI) / 180;

      // Simplified intersection calculation
      const denominator = Math.sin(bearing1) * Math.cos(bearing2) - Math.cos(bearing1) * Math.sin(bearing2);
      
      if (Math.abs(denominator) < 1e-10) {
        return null; // Vectors are parallel
      }

      // Calculate intersection point
      const numerator = (lat2 - lat1) * Math.sin(bearing2) - (lng2 - lng1) * Math.cos(bearing2);
      const t = numerator / denominator;

      const intersectionLat = lat1 + t * Math.sin(bearing1);
      const intersectionLng = lng1 + t * Math.cos(bearing1);

      return {
        lat: (intersectionLat * 180) / Math.PI,
        lng: (intersectionLng * 180) / Math.PI
      };

    } catch (err) {
      console.error('Error calculating vector intersection:', err);
      return null;
    }
  }, []);

  // Select optimal landmarks for triangulation
  const selectOptimalTriangulationSet = useCallback((landmarks) => {
    if (landmarks.length <= 3) return landmarks;

    // Group by bearing sectors (45-degree segments)
    const sectors = {};
    landmarks.forEach(landmark => {
      const sector = Math.floor(landmark.bearing_degrees / 45);
      if (!sectors[sector]) sectors[sector] = [];
      sectors[sector].push(landmark);
    });

    // Select best landmark from each sector
    const selected = [];
    Object.values(sectors).forEach(sectorLandmarks => {
      const bestInSector = sectorLandmarks.sort((a, b) => 
        (b.quality_score || 0.5) - (a.quality_score || 0.5)
      )[0];
      if (bestInSector) selected.push(bestInSector);
    });

    // If we have at least 3 well-distributed landmarks, use them
    if (selected.length >= 3) {
      return selected.sort((a, b) => (b.quality_score || 0.5) - (a.quality_score || 0.5)).slice(0, 6);
    }

    // Otherwise, use top quality landmarks regardless of distribution
    return landmarks
      .sort((a, b) => (b.quality_score || 0.5) - (a.quality_score || 0.5))
      .slice(0, 6);
  }, []);

  // Calculate quality-weighted centroid
  const calculateQualityWeightedCentroid = useCallback((landmarks) => {
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;
    let minAccuracy = Infinity;

    landmarks.forEach(landmark => {
      const quality = landmark.quality_score || 0.5;
      const accuracy = landmark.typical_accuracy_meters || 15;
      const weight = quality * (1 / Math.max(accuracy, 1));
      
      weightedLat += landmark.latitude * weight;
      weightedLng += landmark.longitude * weight;
      totalWeight += weight;
      minAccuracy = Math.min(minAccuracy, accuracy);
    });

    if (totalWeight === 0) return null;

    return {
      latitude: weightedLat / totalWeight,
      longitude: weightedLng / totalWeight,
      accuracy: minAccuracy,
      confidence: Math.min(1, totalWeight / landmarks.length),
      method: 'quality_weighted_centroid'
    };
  }, []);

  // Combine multiple triangulation methods
  const combineTriangulationMethods = useCallback((vectorResult, centroidResult, gpsResult, landmarks) => {
    const methods = [];
    
    if (vectorResult && vectorResult.confidence > 0.6) {
      methods.push({ result: vectorResult, weight: vectorResult.confidence });
    }
    
    if (centroidResult && centroidResult.confidence > 0.5) {
      methods.push({ result: centroidResult, weight: centroidResult.confidence });
    }
    
    // Always include GPS but with lower weight
    methods.push({ 
      result: gpsResult, 
      weight: Math.max(0.3, 1 - ((gpsResult.accuracy || 50) / 100)) 
    });

    let totalWeight = 0;
    let finalLat = 0;
    let finalLng = 0;
    let finalAccuracy = 0;

    methods.forEach(method => {
      finalLat += method.result.latitude * method.weight;
      finalLng += method.result.longitude * method.weight;
      finalAccuracy += (method.result.accuracy || 50) * method.weight;
      totalWeight += method.weight;
    });

    return {
      latitude: finalLat / totalWeight,
      longitude: finalLng / totalWeight,
      accuracy: finalAccuracy / totalWeight,
      confidence: totalWeight / methods.length,
      method: 'combined_triangulation',
      landmarks_used: landmarks.length,
      methods_combined: methods.length
    };
  }, []);

  // Original weighted position calculation (kept for compatibility)
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
        const accuracy = point.accuracy || 50;
        const weight = 1 / Math.max(accuracy, 1);
        
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
        accuracy: Math.min(...points.map(p => p.accuracy || 50))
      };

      console.log('Weighted position calculated:', result);
      return result;

    } catch (err) {
      console.error('Error calculating weighted position:', err);
      return null;
    }
  }, []);

  // Enhanced landmark quality calculation
  const calculateLandmarkQuality = useCallback((landmark, distance, maxRadius) => {
    let quality = 0.5; // Base quality

    // Distance factor (closer is better, but not too close for triangulation)
    const optimalDistance = maxRadius * 0.3; // 30% of search radius
    const distanceScore = Math.max(0, 1 - Math.abs(distance - optimalDistance) / optimalDistance);
    quality += distanceScore * 0.3;

    // Verification factor
    if (landmark.verified) quality += 0.2;

    // Type-based factors
    const typeWeights = {
      'government': 0.9,
      'infrastructure': 0.85,
      'physical_feature': 0.8,
      'commercial': 0.7,
      'public_facility': 0.75,
      'unique': 0.8
    };
    
    quality += (typeWeights[landmark.landmark_type] || 0.5) * 0.2;

    // Accuracy factor
    const accuracy = landmark.typical_accuracy_meters || landmark.accuracy_meters || 20;
    const accuracyScore = Math.max(0, 1 - (accuracy / 50));
    quality += accuracyScore * 0.2;

    return Math.min(1, quality);
  }, []);

  // Calculate bearing between two points
  const calculateBearing = useCallback((lat1, lon1, lat2, lon2) => {
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x);
    bearing = (bearing * 180) / Math.PI;
    bearing = (bearing + 360) % 360;

    return bearing;
  }, []);

  // Get direction description from bearing
  const getDirectionFromBearing = useCallback((bearing) => {
    const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
    const index = Math.round(bearing / 45) % 8;
    return `${directions[index]} of your position`;
  }, []);

  // Determine side of road based on latitude difference
  const determineSideOfRoad = useCallback((userLat, landmarkLat) => {
    const diff = landmarkLat - userLat;
    if (Math.abs(diff) < 0.00001) return 'on_road';
    return diff > 0 ? 'east_side' : 'west_side';
  }, []);

  // Validate coordinate
  const isValidCoordinate = useCallback((lat, lng) => {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }, []);

  // Convert image to WebP format (unchanged from original)
  const convertImageToWebP = useCallback((file, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Selected file is not an image'));
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('Image must be smaller than 10MB'));
        return;
      }

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        try {
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

  // Submit contribution to database (unchanged from original)
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
        .select(
          `id,
          submitted_office_location,
          submitted_county,
          submitted_constituency,
          submitted_latitude,
          submitted_longitude,
          status,
          created_at`
        )
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
    findNearbyLandmarks: findOptimalTriangulationLandmarks, // Enhanced version
    calculateWeightedPosition,
    calculateEnhancedTriangulation, // New enhanced triangulation
    convertImageToWebP,
    submitContribution,
    
    // State
    isSubmitting,
    error,
    
    // Helper functions
    calculateDistance,
    calculateBearing,
    calculateLandmarkQuality,
    getDirectionFromBearing
  };
};

export default useContributeLocation;
