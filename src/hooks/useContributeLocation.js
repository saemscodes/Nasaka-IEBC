// src/hooks/useContributeLocation.js
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useContributeLocation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isFetchingOSM, setIsFetchingOSM] = useState(false);
  const fetchedLocations = useRef(new Set());

  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

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

  const getDirectionFromBearing = useCallback((bearing) => {
    const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
    const index = Math.round(bearing / 45) % 8;
    return `${directions[index]} of your position`;
  }, []);

  const determineSideOfRoad = useCallback((userLat, landmarkLat) => {
    const diff = landmarkLat - userLat;
    if (Math.abs(diff) < 0.00001) return 'on_road';
    return diff > 0 ? 'east_side' : 'west_side';
  }, []);

  const calculateLandmarkQuality = useCallback((landmark, distance, maxRadius) => {
    let quality = 0.5;

    const optimalDistance = maxRadius * 0.3;
    const distanceScore = Math.max(0, 1 - Math.abs(distance - optimalDistance) / optimalDistance);
    quality += distanceScore * 0.3;

    if (landmark.verified) quality += 0.2;

    const typeWeights = {
      'government': 0.9,
      'infrastructure': 0.85,
      'physical_feature': 0.8,
      'commercial': 0.7,
      'public_facility': 0.75,
      'unique': 0.8,
      'road': 0.8,
      'waterway': 0.7,
      'administrative': 0.65,
      'land_use': 0.6
    };
    
    const landmarkType = landmark.landmark_type || landmark.office_landmark_type || 'government';
    quality += (typeWeights[landmarkType] || 0.5) * 0.2;

    const accuracy = landmark.typical_accuracy_meters || landmark.accuracy_meters || 20;
    const accuracyScore = Math.max(0, 1 - (accuracy / 50));
    quality += accuracyScore * 0.2;

    return Math.min(1, quality);
  }, []);

  const isValidCoordinate = useCallback((lat, lng) => {
    const KENYA_BOUNDS = {
      minLat: -4.678, maxLat: 5.506,
      minLng: 33.908, maxLng: 41.899
    };
    return (!isNaN(lat) && !isNaN(lng) &&
            lat >= KENYA_BOUNDS.minLat && lat <= KENYA_BOUNDS.maxLat &&
            lng >= KENYA_BOUNDS.minLng && lng <= KENYA_BOUNDS.maxLng);
  }, []);

  const generateLocationKey = useCallback((lat, lng, radius = 10000) => {
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLng = Math.round(lng * 1000) / 1000;
    return `${roundedLat},${roundedLng},${radius}`;
  }, []);

  const generateDeviceFingerprint = useCallback(async () => {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || '',
      navigator.deviceMemory || ''
    ];

    const fingerprint = components.join('|');
    
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  }, []);

  const hashString = useCallback(async (input) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }, []);

  const fetchOSMDataForLocation = useCallback(async (latitude, longitude, radiusMeters = 10000) => {
    const locationKey = generateLocationKey(latitude, longitude, radiusMeters);
    
    if (fetchedLocations.current.has(locationKey)) {
      console.log('OSM data already fetched for this location:', locationKey);
      return { landmarksAdded: 0, totalProcessed: 0 };
    }

    setIsFetchingOSM(true);
    try {
      console.log('Fetching OSM data for location:', { latitude, longitude, radiusMeters });

      const { data, error } = await supabase.rpc('fetch_and_store_osm_landmarks', {
        p_lat: latitude,
        p_lng: longitude,
        p_radius_meters: radiusMeters
      });

      if (error) {
        console.warn('OSM data fetch failed:', error);
        return { landmarksAdded: 0, totalProcessed: 0 };
      }

      if (data && data.length > 0) {
        const result = data[0];
        console.log(`OSM data fetch successful: ${result.landmarks_added} new landmarks added from ${result.total_landmarks} features`);
        
        fetchedLocations.current.add(locationKey);
        
        return result;
      }

      return { landmarksAdded: 0, totalProcessed: 0 };

    } catch (err) {
      console.error('Error fetching OSM data:', err);
      return { landmarksAdded: 0, totalProcessed: 0 };
    } finally {
      setIsFetchingOSM(false);
    }
  }, [generateLocationKey]);

  const getCurrentPosition = useCallback(async (options = {}) => {
    const { enableOSMFetching = true, osmRadius = 10000 } = options;
    
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const positionData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          };

          if (enableOSMFetching) {
            try {
              await fetchOSMDataForLocation(
                positionData.latitude, 
                positionData.longitude, 
                osmRadius
              );
            } catch (osmError) {
              console.warn('Background OSM fetch failed:', osmError);
            }
          }

          resolve(positionData);
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
          maximumAge: 0,
          ...options
        }
      );
    });
  }, [fetchOSMDataForLocation]);

  const findOptimalTriangulationLandmarks = useCallback(async (latitude, longitude, radiusMeters = 2000, options = {}) => {
    const { ensureData = true, maxRetries = 2 } = options;
    
    try {
      console.log('Searching for optimal triangulation landmarks...', { 
        latitude, 
        longitude, 
        radiusMeters,
        ensureData
      });

      if (ensureData) {
        const osmResult = await fetchOSMDataForLocation(latitude, longitude, radiusMeters);
        console.log('OSM data enrichment result:', osmResult);
      }

      let landmarks = [];
      let attempt = 0;

      while (attempt <= maxRetries && landmarks.length === 0) {
        try {
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_optimal_triangulation_landmarks', {
              p_lat: latitude,
              p_lng: longitude,
              p_radius_meters: radiusMeters,
              p_max_landmarks: 8
            });

          if (!rpcError && rpcData && rpcData.length > 0) {
            console.log(`Found ${rpcData.length} enhanced triangulation landmarks on attempt ${attempt + 1}`);
            landmarks = rpcData;
            break;
          } else if (rpcError) {
            console.warn(`RPC attempt ${attempt + 1} failed:`, rpcError);
          }
        } catch (rpcError) {
          console.warn(`RPC call attempt ${attempt + 1} failed:`, rpcError);
        }

        attempt++;
        
        if (attempt <= maxRetries && landmarks.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (landmarks.length === 0) {
        console.log('Using comprehensive fallback landmark detection...');
        const fallbackLandmarks = await getFallbackLandmarks(latitude, longitude, radiusMeters);
        landmarks = fallbackLandmarks;
      }

      console.log('Final landmarks found:', landmarks.length);
      return landmarks;

    } catch (err) {
      console.error('Error in findOptimalTriangulationLandmarks:', err);
      throw new Error(`Failed to find triangulation landmarks: ${err.message}`);
    }
  }, [fetchOSMDataForLocation, calculateDistance, calculateBearing, calculateLandmarkQuality, getDirectionFromBearing, determineSideOfRoad]);

  const getFallbackLandmarks = useCallback(async (latitude, longitude, radiusMeters) => {
    const fallbackLandmarks = [];

    try {
      const { data: officeData, error: officeError } = await supabase
        .rpc('get_nearby_iebc_offices', {
          p_lat: latitude,
          p_lng: longitude,
          p_radius: radiusMeters
        });

      if (!officeError && officeData && Array.isArray(officeData)) {
        const processedOffices = officeData
          .filter(office => office && office.office_latitude && office.office_longitude)
          .map(office => {
            const distance = calculateDistance(latitude, longitude, office.office_latitude, office.office_longitude);
            const bearing = calculateBearing(latitude, longitude, office.office_latitude, office.office_longitude);
            const qualityScore = calculateLandmarkQuality(office, distance, radiusMeters);

            return {
              landmark_id: office.office_id || `office_${Date.now()}`,
              landmark_name: office.office_name || 'IEBC Office',
              landmark_type: 'government',
              landmark_subtype: 'iebc_office',
              landmark_latitude: office.office_latitude,
              landmark_longitude: office.office_longitude,
              distance_meters: distance,
              bearing_degrees: bearing,
              triangulation_weight: 0.85,
              quality_score: qualityScore,
              direction_description: getDirectionFromBearing(bearing),
              side_of_road: determineSideOfRoad(latitude, office.office_latitude),
              typical_accuracy_meters: 15
            };
          });
        fallbackLandmarks.push(...processedOffices);
      }
    } catch (officeError) {
      console.warn('IEBC offices fallback failed:', officeError);
    }

    try {
      if (fallbackLandmarks.length < 3) {
        const { data: directOfficeData, error: directError } = await supabase
          .from('iebc_offices')
          .select('*')
          .eq('verified', true)
          .limit(20);

        if (!directError && directOfficeData && Array.isArray(directOfficeData)) {
          const processedDirect = directOfficeData
            .map(office => {
              if (!office) return null;
              
              const officeLat = office.verified_latitude || office.latitude;
              const officeLng = office.verified_longitude || office.longitude;
              
              if (!officeLat || !officeLng || isNaN(officeLat) || isNaN(officeLng)) return null;

              const distance = calculateDistance(latitude, longitude, officeLat, officeLng);
              if (distance > radiusMeters) return null;

              const bearing = calculateBearing(latitude, longitude, officeLat, officeLng);
              const qualityScore = calculateLandmarkQuality(office, distance, radiusMeters);

              return {
                landmark_id: office.id || `office_${Date.now()}`,
                landmark_name: office.office_location || 'IEBC Office',
                landmark_type: 'government',
                landmark_subtype: 'iebc_office',
                landmark_latitude: officeLat,
                landmark_longitude: officeLng,
                distance_meters: distance,
                bearing_degrees: bearing,
                triangulation_weight: 0.85,
                quality_score: qualityScore,
                direction_description: getDirectionFromBearing(bearing),
                side_of_road: determineSideOfRoad(latitude, officeLat),
                typical_accuracy_meters: 15
              };
            })
            .filter(office => office !== null && office.landmark_latitude && office.landmark_longitude)
            .sort((a, b) => b.quality_score - a.quality_score)
            .slice(0, 8 - fallbackLandmarks.length);

          fallbackLandmarks.push(...processedDirect);
        }
      }
    } catch (directError) {
      console.warn('Direct database fallback failed:', directError);
    }

    try {
      if (fallbackLandmarks.length < 5) {
       const { data: mapLandmarks, error: mapError } = await supabase
         .from('map_landmarks_readable')
         .select('*')
         .eq('verified', true)
         .limit(25);
                
        if (!mapError && mapLandmarks && Array.isArray(mapLandmarks)) {
          const processedMap = mapLandmarks
            .map(landmark => {
              try {
                if (!landmark) return null;
                
                let landmarkLat, landmarkLng;
                
                if (landmark.centroid_wkt && typeof landmark.centroid_wkt === 'string') {
                  const match = landmark.centroid_wkt.match(/POINT\(([^ ]+) ([^ ]+)\)/);
                  if (match) {
                    landmarkLng = parseFloat(match[1]);
                    landmarkLat = parseFloat(match[2]);
                  }
                }
                
                if (!landmarkLat || !landmarkLng || isNaN(landmarkLat) || isNaN(landmarkLng)) {
                  return null;
                }

                const distance = calculateDistance(latitude, longitude, landmarkLat, landmarkLng);
                
                if (distance > radiusMeters) return null;

                const bearing = calculateBearing(latitude, longitude, landmarkLat, landmarkLng);
                const qualityScore = calculateLandmarkQuality(landmark, distance, radiusMeters);

                return {
                  landmark_id: landmark.id || `landmark_${Date.now()}`,
                  landmark_name: landmark.name || landmark.landmark_subtype || 'Unknown Landmark',
                  landmark_type: landmark.landmark_type || 'unknown',
                  landmark_subtype: landmark.landmark_subtype || 'unknown',
                  landmark_latitude: landmarkLat,
                  landmark_longitude: landmarkLng,
                  distance_meters: distance,
                  bearing_degrees: bearing,
                  triangulation_weight: landmark.triangulation_weight || 0.7,
                  quality_score: qualityScore,
                  direction_description: getDirectionFromBearing(bearing),
                  side_of_road: 'unknown',
                  typical_accuracy_meters: landmark.typical_accuracy_meters || 20
                };
              } catch (parseError) {
                console.warn('Error processing landmark coordinates:', parseError);
                return null;
              }
            })
            .filter(landmark => landmark !== null && landmark.landmark_latitude && landmark.landmark_longitude)
            .sort((a, b) => b.quality_score - a.quality_score)
            .slice(0, 8 - fallbackLandmarks.length);

          fallbackLandmarks.push(...processedMap);
        }
      }
    } catch (mapError) {
      console.warn('Map landmarks fallback failed:', mapError);
    }

    return fallbackLandmarks
      .sort((a, b) => b.quality_score - a.quality_score)
      .slice(0, 8);
  }, [calculateDistance, calculateBearing, calculateLandmarkQuality, getDirectionFromBearing, determineSideOfRoad]);

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
        if (!point || !point.latitude || !point.longitude || isNaN(point.latitude) || isNaN(point.longitude)) {
          console.warn('Invalid point in triangulation data:', point);
          return;
        }

        const accuracy = point.accuracy || 50;
        const weight = 1 / Math.max(accuracy, 1);
        
        weightedLat += point.latitude * weight;
        weightedLng += point.longitude * weight;
        totalWeight += weight;
      });

      if (totalWeight === 0 || isNaN(totalWeight)) {
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

  const calculateEnhancedTriangulation = useCallback(async (userPosition, landmarks, options = {}) => {
    const { fetchAdditionalData = true } = options;
    
    if (!userPosition || !userPosition.latitude || !userPosition.longitude) {
      console.warn('Invalid user position provided for triangulation');
      return null;
    }
    
    if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 3) {
      console.warn('Insufficient landmarks for enhanced triangulation');
      
      if (fetchAdditionalData) {
        try {
          const newLandmarks = await findOptimalTriangulationLandmarks(
            userPosition.latitude, 
            userPosition.longitude, 
            2000, 
            { ensureData: true }
          );
          
          if (newLandmarks && newLandmarks.length >= 3) {
            landmarks = newLandmarks;
            console.log('Fetched additional landmarks for triangulation:', newLandmarks.length);
          }
        } catch (fetchError) {
          console.warn('Failed to fetch additional landmarks:', fetchError);
        }
      }
      
      if (!landmarks || landmarks.length < 3) {
        return userPosition;
      }
    }

    try {
      console.log('Performing enhanced triangulation with', landmarks.length, 'landmarks');

      const validLandmarks = landmarks
        .slice(0, 3)
        .filter(landmark => 
          landmark && 
          (landmark.landmark_latitude || landmark.latitude) && 
          (landmark.landmark_longitude || landmark.longitude)
        )
        .map(landmark => ({
          latitude: landmark.landmark_latitude || landmark.latitude,
          longitude: landmark.landmark_longitude || landmark.longitude,
          accuracy: landmark.typical_accuracy_meters || 20
        }));

      if (validLandmarks.length === 0) {
        console.warn('No valid landmarks available for triangulation');
        return userPosition;
      }

      const pointsToAverage = [userPosition, ...validLandmarks];

      const result = calculateWeightedPosition(pointsToAverage);
      
      if (!result) {
        console.warn('Weighted position calculation failed, using original position');
        return userPosition;
      }
      
      console.log('Enhanced triangulation result:', {
        inputGPS: userPosition,
        finalResult: result,
        landmarksUsed: validLandmarks.length
      });

      return result;

    } catch (err) {
      console.error('Error in enhanced triangulation:', err);
      return userPosition;
    }
  }, [findOptimalTriangulationLandmarks, calculateWeightedPosition]);

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

  const submitContribution = useCallback(async (contributionData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Starting contribution submission process...', {
        latitude: contributionData.submitted_latitude,
        longitude: contributionData.submitted_longitude,
        hasImage: !!contributionData.imageFile,
        notesLength: contributionData.submitted_landmark?.length || 0
      });

      if (!contributionData.submitted_latitude || !contributionData.submitted_longitude) {
        throw new Error('Latitude and longitude are required for submission');
      }

      if (Math.abs(contributionData.submitted_latitude) > 90 || Math.abs(contributionData.submitted_longitude) > 180) {
        throw new Error('Invalid coordinates provided');
      }

      const deviceFingerprint = await generateDeviceFingerprint();
      
      let imagePublicUrl = null;
      if (contributionData.imageFile) {
        console.log('Uploading contribution image...');
        
        const fileName = `${Date.now()}_${contributionData.imageFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('iebc-contributions')
          .upload(fileName, contributionData.imageFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/webp'
          });

        if (uploadError) {
          console.error('Image upload failed:', uploadError);
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('iebc-contributions')
          .getPublicUrl(fileName);
        
        imagePublicUrl = urlData.publicUrl;
        console.log('Image uploaded successfully:', imagePublicUrl);
      }

      const deviceMeta = {
        accuracy: contributionData.submitted_accuracy_meters || null,
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
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        capture_method: contributionData.capture_method || 'unknown'
      };

      const contribution = {
        submitted_latitude: contributionData.submitted_latitude,
        submitted_longitude: contributionData.submitted_longitude,
        submitted_accuracy_meters: contributionData.submitted_accuracy_meters,
        submitted_office_location: contributionData.submitted_office_location,
        submitted_county: contributionData.submitted_county,
        submitted_constituency: contributionData.submitted_constituency,
        submitted_constituency_code: contributionData.submitted_constituency_code || null,
        submitted_landmark: contributionData.submitted_landmark,
        google_maps_link: contributionData.google_maps_link,
        image_public_url: imagePublicUrl,
        device_metadata: deviceMeta,
        device_fingerprint_hash: deviceFingerprint,
        status: 'pending',
        submission_source: 'web_contribution',
        original_office_id: contributionData.original_office_id || null,
        nearby_landmarks: contributionData.nearby_landmarks || null,
        confidence_score: contributionData.confidence_score || 0,
        exif_metadata: contributionData.exif_metadata || {},
        reverse_geocode_result: contributionData.reverse_geocode_result || null
      };

      console.log('Inserting contribution into database...');
      
      const { data, error: insertError } = await supabase
        .from('iebc_office_contributions')
        .insert(contribution)
        .select()
        .single();

      if (insertError) {
        console.error('Database insertion failed:', insertError);
        throw new Error(`Failed to save contribution: ${insertError.message}`);
      }

      console.log('Contribution submitted successfully:', data);
      
      console.log('Contribution Analytics:', {
        contributionId: data.id,
        location: `${data.submitted_latitude}, ${data.submitted_longitude}`,
        county: data.submitted_county,
        constituency: data.submitted_constituency,
        hasImage: !!imagePublicUrl,
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

  const manuallyFetchOSMData = useCallback(async (latitude, longitude, radiusMeters = 2000) => {
    return await fetchOSMDataForLocation(latitude, longitude, radiusMeters);
  }, [fetchOSMDataForLocation]);

  const findNearbyLandmarks = useCallback(async (latitude, longitude, radius = 500) => {
    try {
      const { data, error } = await supabase
        .rpc('find_nearby_offices', {
          p_lat: latitude,
          p_lng: longitude,
          p_radius: radius
        });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error finding nearby landmarks:', err);
      return [];
    }
  }, []);

  const checkRateLimit = useCallback(async () => {
    try {
      const deviceFingerprint = await generateDeviceFingerprint();
      const ipHash = await hashString('client-ip-placeholder');

      const { data, error } = await supabase
        .rpc('check_submission_rate_limit', {
          p_ip_hash: ipHash,
          p_device_hash: deviceFingerprint
        });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Rate limit check failed:', err);
      return { allowed: true, reason: 'OK', retry_after_seconds: 0 };
    }
  }, [generateDeviceFingerprint, hashString]);

  return {
    getCurrentPosition,
    convertImageToWebP,
    findNearbyLandmarks,
    calculateWeightedPosition,
    submitContribution,
    isSubmitting,
    error,
    findOptimalTriangulationLandmarks,
    calculateEnhancedTriangulation,
    manuallyFetchOSMData,
    isFetchingOSM,
    calculateDistance,
    calculateBearing,
    calculateLandmarkQuality,
    getDirectionFromBearing,
    determineSideOfRoad,
    isValidCoordinate,
    checkRateLimit,
    generateDeviceFingerprint,
    hashString
  };
};

export default useContributeLocation;
