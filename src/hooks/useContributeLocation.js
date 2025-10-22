// src/hooks/useContributeLocation.js
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useContributeLocation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isFetchingOSM, setIsFetchingOSM] = useState(false);
  const fetchedLocations = useRef(new Set());

  // Calculate distance between two coordinates
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

  // NEW: Reverse geocoding function
  const reverseGeocode = useCallback(async (latitude, longitude) => {
    try {
      console.log('Reverse geocoding coordinates:', { latitude, longitude });
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }
      
      const data = await response.json();
      console.log('Reverse geocode result:', data);
      
      return {
        display_name: data.display_name,
        address: data.address,
        boundingbox: data.boundingbox,
        full_result: data
      };
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      return null;
    }
  }, []);

  // NEW: Extract EXIF data from image
  const extractExifData = useCallback(async (file) => {
    return new Promise((resolve) => {
      if (!file) {
        resolve({});
        return;
      }

      const reader = new FileReader();
      
      reader.onload = function(e) {
        const view = new DataView(e.target.result);
        
        let exifData = {
          has_exif: false,
          file_size: file.size,
          file_type: file.type,
          last_modified: file.lastModified,
          file_name: file.name
        };
        
        let offset = 0;
        
        if (view.getUint16(0) !== 0xFFD8) {
          resolve(exifData);
          return;
        }
        
        offset += 2;
        
        while (offset < view.byteLength - 1) {
          if (view.getUint16(offset) === 0xFFE1) {
            exifData.has_exif = true;
            break;
          }
          offset++;
        }
        
        resolve(exifData);
      };
      
      reader.onerror = () => resolve({});
      reader.readAsArrayBuffer(file.slice(0, 65536));
    });
  }, []);

  // NEW: Find nearby features for enrichment
  const findNearbyFeatures = useCallback(async (latitude, longitude, radiusMeters = 500) => {
    try {
      console.log('Finding nearby features for enrichment...');
      
      const nearbyData = {
        offices: [],
        landmarks: [],
        constituencies: []
      };

      try {
        const { data: officesData, error: officesError } = await supabase
          .rpc('find_nearby_offices', {
            p_lat: latitude,
            p_lng: longitude,
            p_radius: radiusMeters
          });

        if (!officesError && officesData) {
          nearbyData.offices = officesData.map(office => ({
            id: office.id,
            office_name: office.office_name,
            office_location: office.office_location,
            distance: calculateDistance(latitude, longitude, office.latitude, office.longitude),
            is_duplicate_candidate: calculateDistance(latitude, longitude, office.latitude, office.longitude) < 100
          }));
        }
      } catch (officeError) {
        console.warn('Nearby offices search failed:', officeError);
      }

      try {
        const { data: landmarksData, error: landmarksError } = await supabase
          .rpc('get_nearby_landmarks', {
            p_lat: latitude,
            p_lng: longitude,
            p_radius_meters: radiusMeters
          });

        if (!landmarksError && landmarksData) {
          nearbyData.landmarks = landmarksData;
        }
      } catch (landmarkError) {
        console.warn('Nearby landmarks search failed:', landmarkError);
      }

      try {
        const { data: constituencyData, error: constituencyError } = await supabase
          .rpc('get_constituency_from_coords', {
            p_lat: latitude,
            p_lng: longitude
          });

        if (!constituencyError && constituencyData) {
          nearbyData.constituencies = Array.isArray(constituencyData) ? constituencyData : [constituencyData];
        }
      } catch (constituencyError) {
        console.warn('Constituency lookup failed:', constituencyError);
      }

      console.log('Nearby features found:', nearbyData);
      return nearbyData;

    } catch (error) {
      console.error('Error finding nearby features:', error);
      return { offices: [], landmarks: [], constituencies: [] };
    }
  }, [calculateDistance]);

  // NEW: Calculate confidence score
  const calculateConfidenceScore = useCallback((contributionData, nearbyFeatures, exifData, reverseGeocodeResult) => {
    let score = 50;
    
    console.log('Calculating confidence score with data:', {
      contributionData,
      nearbyFeaturesCount: nearbyFeatures.offices.length,
      hasExif: !!exifData?.has_exif,
      hasReverseGeocode: !!reverseGeocodeResult
    });

    const accuracy = contributionData.submitted_accuracy_meters || 50;
    if (accuracy <= 10) score += 20;
    else if (accuracy <= 20) score += 15;
    else if (accuracy <= 50) score += 10;
    else if (accuracy <= 100) score += 5;

    if (contributionData.imageFile) {
      score += 10;
      if (exifData?.has_exif) score += 5;
    }

    if (reverseGeocodeResult) {
      score += 10;
      const reverseCounty = reverseGeocodeResult.address?.county || reverseGeocodeResult.address?.state;
      if (reverseCounty && contributionData.submitted_county && 
          reverseCounty.toLowerCase().includes(contributionData.submitted_county.toLowerCase())) {
        score += 5;
      }
    }

    const duplicateCount = nearbyFeatures.offices.filter(o => o.is_duplicate_candidate).length;
    if (duplicateCount === 0) score += 20;
    else if (duplicateCount === 1) score += 10;
    else if (duplicateCount <= 3) score += 5;

    let completeness = 0;
    if (contributionData.submitted_office_location) completeness += 3;
    if (contributionData.submitted_county) completeness += 3;
    if (contributionData.submitted_constituency) completeness += 2;
    if (contributionData.submitted_landmark) completeness += 2;
    score += completeness;

    score = Math.min(100, Math.max(0, score));
    
    console.log('Final confidence score:', score);
    return score;
  }, []);

  // NEW: Get constituency code from name
  const getConstituencyCode = useCallback(async (constituencyName, countyName) => {
    if (!constituencyName) return null;
    
    try {
      const { data, error } = await supabase
        .rpc('get_constituency_code', {
          p_constituency_name: constituencyName,
          p_county_name: countyName
        });

      if (!error && data) {
        return data.code || null;
      }
    } catch (error) {
      console.warn('Constituency code lookup failed:', error);
    }

    return null;
  }, []);

  // NEW: Main data enrichment function
  const enrichContributionData = useCallback(async (contributionData) => {
    console.log('Starting data enrichment process...');
    
    const enrichedData = { ...contributionData };
    const latitude = contributionData.submitted_latitude;
    const longitude = contributionData.submitted_longitude;

    const [
      exifData,
      reverseGeocodeResult,
      nearbyFeatures
    ] = await Promise.all([
      extractExifData(contributionData.imageFile),
      reverseGeocode(latitude, longitude),
      findNearbyFeatures(latitude, longitude, 500)
    ]);

    enrichedData.exif_metadata = exifData;
    enrichedData.reverse_geocode_result = reverseGeocodeResult;
    enrichedData.nearby_landmarks = nearbyFeatures.landmarks;
    
    if (reverseGeocodeResult?.address) {
      const address = reverseGeocodeResult.address;
      
      if (!enrichedData.submitted_county) {
        enrichedData.submitted_county = address.county || address.state || null;
      }
      
      if (!enrichedData.submitted_constituency && address.state_district) {
        enrichedData.submitted_constituency = address.state_district;
      }
      
      if (!enrichedData.submitted_landmark) {
        const landmark = address.road || address.neighbourhood || address.suburb;
        if (landmark) {
          enrichedData.submitted_landmark = `Near ${landmark}`;
        }
      }
    }

    if (enrichedData.submitted_constituency && enrichedData.submitted_county) {
      enrichedData.submitted_constituency_code = await getConstituencyCode(
        enrichedData.submitted_constituency,
        enrichedData.submitted_county
      );
    }

    enrichedData.duplicate_candidate_ids = nearbyFeatures.offices
      .filter(office => office.is_duplicate_candidate)
      .map(office => office.id);

    enrichedData.confidence_score = calculateConfidenceScore(
      enrichedData,
      nearbyFeatures,
      exifData,
      reverseGeocodeResult
    );

    enrichedData.confirmation_count = 0;
    enrichedData.submission_source = 'web_contribution';
    enrichedData.submission_method = contributionData.capture_method || 'unknown';
    enrichedData.submitted_timestamp = new Date().toISOString();

    console.log('Data enrichment completed:', enrichedData);
    return enrichedData;
  }, [extractExifData, reverseGeocode, findNearbyFeatures, getConstituencyCode, calculateConfidenceScore]);

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
  }, [fetchOSMDataForLocation, getFallbackLandmarks]);

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

  const uploadImage = useCallback(async (file, contributionId) => {
    if (!file) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${contributionId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `office-contributions/${fileName}`;

      console.log('Uploading image to bucket:', 'iebc_contributions', filePath);

      const { error: uploadError } = await supabase.storage
        .from('iebc_contributions')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('iebc_contributions')
        .getPublicUrl(filePath);

      console.log('Image uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (err) {
      console.error('Error in uploadImage:', err);
      throw err;
    }
  }, []);

  // UPDATED: Enhanced submit function with data enrichment
  const submitContribution = useCallback(async (contributionData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Starting enhanced contribution submission...', {
        latitude: contributionData.submitted_latitude,
        longitude: contributionData.submitted_longitude,
        hasImage: !!contributionData.imageFile
      });

      if (!contributionData.submitted_latitude || !contributionData.submitted_longitude) {
        throw new Error('Latitude and longitude are required for submission');
      }

      if (Math.abs(contributionData.submitted_latitude) > 90 || Math.abs(contributionData.submitted_longitude) > 180) {
        throw new Error('Invalid coordinates provided');
      }

      const deviceFingerprint = await generateDeviceFingerprint();
      
      console.log('Enriching contribution data...');
      const enrichedData = await enrichContributionData(contributionData);
      
      let imagePublicUrl = null;
      if (enrichedData.imageFile) {
        console.log('Uploading contribution image...');
        const tempContributionId = `temp_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        imagePublicUrl = await uploadImage(enrichedData.imageFile, tempContributionId);
        console.log('Image uploaded successfully:', imagePublicUrl);
      }

      const deviceMeta = enrichedData.device_metadata || {
        accuracy: enrichedData.submitted_accuracy_meters || null,
        userAgent: navigator.userAgent ? navigator.userAgent.substring(0, 100) : 'unknown',
        platform: navigator.platform || 'unknown',
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language || 'en',
        hasTouch: 'ontouchstart' in window,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        capture_method: enrichedData.capture_method || 'unknown',
        capture_source: enrichedData.capture_source || 'manual',
        duplicate_count: enrichedData.duplicate_candidate_ids?.length || 0,
        timestamp: new Date().toISOString(),
        confidence_score: enrichedData.confidence_score
      };

      const contribution = {
        submitted_latitude: enrichedData.submitted_latitude,
        submitted_longitude: enrichedData.submitted_longitude,
        submitted_accuracy_meters: enrichedData.submitted_accuracy_meters || 50,
        submitted_office_location: enrichedData.submitted_office_location,
        submitted_county: enrichedData.submitted_county,
        submitted_constituency: enrichedData.submitted_constituency,
        submitted_constituency_code: enrichedData.submitted_constituency_code || null,
        submitted_landmark: enrichedData.submitted_landmark,
        google_maps_link: enrichedData.google_maps_link,
        image_public_url: imagePublicUrl,
        device_metadata: deviceMeta,
        device_fingerprint_hash: deviceFingerprint,
        status: 'pending_review',
        submission_source: enrichedData.submission_source,
        submission_method: enrichedData.submission_method,
        original_office_id: enrichedData.original_office_id || null,
        nearby_landmarks: enrichedData.nearby_landmarks || null,
        confidence_score: enrichedData.confidence_score || 0,
        exif_metadata: enrichedData.exif_metadata || {},
        reverse_geocode_result: enrichedData.reverse_geocode_result || null,
        duplicate_candidate_ids: enrichedData.duplicate_candidate_ids || [],
        confirmation_count: enrichedData.confirmation_count || 0,
        submitted_timestamp: enrichedData.submitted_timestamp
      };

      console.log('Inserting enriched contribution into database...', contribution);
      
      const { data, error: insertError } = await supabase
        .from('iebc_office_contributions')
        .insert(contribution)
        .select()
        .single();

      if (insertError) {
        console.error('Database insertion failed:', insertError);
        throw new Error(`Failed to save contribution: ${insertError.message}`);
      }

      console.log('Enriched contribution submitted successfully:', data);
      
      console.log('Contribution Analytics:', {
        contributionId: data.id,
        location: `${data.submitted_latitude}, ${data.submitted_longitude}`,
        county: data.submitted_county,
        constituency: data.submitted_constituency,
        confidenceScore: data.confidence_score,
        hasImage: !!imagePublicUrl,
        duplicateCandidates: data.duplicate_candidate_ids?.length || 0,
        timestamp: data.created_at
      });

      return data;

    } catch (err) {
      console.error('Enhanced contribution submission error:', err);
      const errorMessage = err.message || 'An unexpected error occurred during submission';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [generateDeviceFingerprint, enrichContributionData, uploadImage]);

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
    hashString,
    reverseGeocode,
    extractExifData,
    findNearbyFeatures,
    calculateConfidenceScore,
    enrichContributionData
  };
};

export default useContributeLocation;
