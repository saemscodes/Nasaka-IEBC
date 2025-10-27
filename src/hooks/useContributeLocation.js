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
      
      let constituencyInfo = null;
      try {
        const { data: localConstituencyData } = await findConstituencyFromCoords(latitude, longitude);
        if (localConstituencyData && localConstituencyData.length > 0) {
          constituencyInfo = {
            name: localConstituencyData[0].name,
            county: localConstituencyData[0].county_name,
            id: localConstituencyData[0].id
          };
        }
      } catch (constituencyError) {
        console.warn('Local constituency lookup failed:', constituencyError);
      }
      
      return {
        display_name: data.display_name,
        address: data.address,
        boundingbox: data.boundingbox,
        full_result: data,
        constituency_info: constituencyInfo
      };
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      return null;
    }
  }, []);

  const findConstituencyFromCoords = useCallback(async (latitude, longitude) => {
    try {
      console.log('Local constituency lookup for:', { latitude, longitude });
      
      // FIXED: Use direct table query instead of problematic RPC function
      const { data, error } = await supabase
        .from('constituencies')
        .select('id, name, county_id, counties(name)')
        .gte('bounding_box_min_lat', latitude - 0.1)
        .lte('bounding_box_max_lat', latitude + 0.1)
        .gte('bounding_box_min_lng', longitude - 0.1)
        .lte('bounding_box_max_lng', longitude + 0.1)
        .limit(5);

      if (error) {
        console.warn('Direct constituency lookup failed:', error);
        
        // Fallback: Get all constituencies and filter by distance
        const { data: allConstituencies, error: allError } = await supabase
          .from('constituencies')
          .select('id, name, county_id, centroid_lat, centroid_lng, counties(name)')
          .limit(50);

        if (allError) {
          console.warn('Fallback constituency lookup failed:', allError);
          return { data: [], error };
        }

        // Calculate distances and return closest constituencies
        const constituenciesWithDistance = allConstituencies.map(constituency => {
          const distance = calculateDistance(
            latitude, 
            longitude, 
            constituency.centroid_lat || latitude, 
            constituency.centroid_lng || longitude
          );
          return { ...constituency, distance };
        }).sort((a, b) => a.distance - b.distance).slice(0, 5);

        return { data: constituenciesWithDistance, error: null };
      }

      console.log('Found constituencies via direct query:', data);
      return { data: data || [], error: null };
    } catch (error) {
      console.warn('Local constituency lookup error:', error);
      return { data: [], error };
    }
  }, [calculateDistance]);

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
          .from('iebc_offices')
          .select('*')
          .gte('latitude', latitude - 0.01)
          .lte('latitude', latitude + 0.01)
          .gte('longitude', longitude - 0.01)
          .lte('longitude', longitude + 0.01)
          .limit(10);

        if (!officesError && officesData) {
          nearbyData.offices = officesData.map(office => ({
            id: office.id,
            office_name: office.office_name,
            office_location: office.office_location,
            latitude: office.latitude,
            longitude: office.longitude,
            distance: calculateDistance(latitude, longitude, office.latitude, office.longitude),
            is_duplicate_candidate: calculateDistance(latitude, longitude, office.latitude, office.longitude) < 100
          }));
        }
      } catch (officeError) {
        console.warn('Nearby offices search failed:', officeError);
      }

      try {
        // FIXED: Use proper column names for landmarks table
        const { data: landmarksData, error: landmarksError } = await supabase
          .from('map_landmarks')
          .select('*')
          .gte('centroid_lat', latitude - 0.01)
          .lte('centroid_lat', latitude + 0.01)
          .gte('centroid_lng', longitude - 0.01)
          .lte('centroid_lng', longitude + 0.01)
          .limit(10);

        if (!landmarksError && landmarksData) {
          nearbyData.landmarks = landmarksData;
        }
      } catch (landmarkError) {
        console.warn('Nearby landmarks search failed:', landmarkError);
      }

      try {
        const { data: constituencyData } = await findConstituencyFromCoords(latitude, longitude);
        if (constituencyData) {
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
  }, [calculateDistance, findConstituencyFromCoords]);

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

  const getConstituencyId = useCallback(async (constituencyName, countyName) => {
    if (!constituencyName) {
      console.warn('No constituency name provided for lookup');
      return null;
    }
    
    try {
      console.log('Looking up constituency ID for:', constituencyName, 'in county:', countyName);
      
      // FIXED: Use direct query instead of RPC function
      const { data, error } = await supabase
        .from('constituencies')
        .select('id, name, county_id')
        .ilike('name', `%${constituencyName}%`)
        .limit(1);

      if (error) {
        console.error('Direct constituency lookup failed:', error);
        return null;
      }

      if (data && data.length > 0) {
        console.log('Found constituency:', data[0]);
        return data[0].id;
      }

      console.warn('No constituency found for:', constituencyName);
      return null;

    } catch (error) {
      console.error('Constituency ID lookup failed:', error);
      return null;
    }
  }, []);

  const createMissingConstituency = useCallback(async (constituencyName, countyName) => {
    try {
      console.log('Creating missing constituency:', constituencyName, 'for county:', countyName);
      
      const { data: countyData, error: countyError } = await supabase
        .from('counties')
        .select('id')
        .ilike('name', `%${countyName}%`)
        .single();

      if (countyError || !countyData) {
        console.error('County not found for constituency creation:', countyError);
        return null;
      }

      const { data: newConstituency, error: createError } = await supabase
        .from('constituencies')
        .insert({
          name: constituencyName,
          county_id: countyData.id,
          registration_target: 0,
          centroid_lat: 0,
          centroid_lng: 0,
          bounding_box_min_lat: 0,
          bounding_box_max_lat: 0,
          bounding_box_min_lng: 0,
          bounding_box_max_lng: 0
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create constituency:', createError);
        return null;
      }

      console.log('Successfully created new constituency:', newConstituency);
      return newConstituency.id;
    } catch (error) {
      console.error('Error creating missing constituency:', error);
      return null;
    }
  }, []);

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
    
    if (reverseGeocodeResult?.constituency_info) {
      const constituencyInfo = reverseGeocodeResult.constituency_info;
      
      if (!enrichedData.submitted_county && constituencyInfo.county) {
        enrichedData.submitted_county = constituencyInfo.county;
      }
      
      if (!enrichedData.submitted_constituency && constituencyInfo.name) {
        enrichedData.submitted_constituency = constituencyInfo.name;
      }
      
      if (constituencyInfo.id) {
        enrichedData.submitted_constituency_id = constituencyInfo.id;
      }
      
      if (!enrichedData.submitted_landmark) {
        const address = reverseGeocodeResult.address;
        const landmark = address?.road || address?.neighbourhood || address?.suburb;
        if (landmark) {
          enrichedData.submitted_landmark = `Near ${landmark}`;
        }
      }
    } else if (reverseGeocodeResult?.address) {
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

    if (!enrichedData.submitted_constituency_id && enrichedData.submitted_constituency) {
      console.log('Getting constituency ID for:', enrichedData.submitted_constituency, enrichedData.submitted_county);
      enrichedData.submitted_constituency_id = await getConstituencyId(
        enrichedData.submitted_constituency,
        enrichedData.submitted_county
      );
      console.log('Constituency ID result:', enrichedData.submitted_constituency_id);
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
  }, [extractExifData, reverseGeocode, findNearbyFeatures, getConstituencyId, calculateConfidenceScore]);

  const updateExistingConstituencyIds = useCallback(async () => {
    try {
      console.log('Updating constituency IDs in existing contributions...');
      
      const { data: contributions, error: contributionsError } = await supabase
        .from('iebc_office_contributions')
        .select('id, submitted_constituency, submitted_county')
        .is('submitted_constituency_id', null)
        .not('submitted_constituency', 'is', null);

      if (contributionsError) {
        throw new Error(`Failed to fetch contributions: ${contributionsError.message}`);
      }

      console.log(`Found ${contributions?.length || 0} contributions to update`);

      let updatedCount = 0;
      for (const contribution of contributions || []) {
        try {
          const constituencyId = await getConstituencyId(
            contribution.submitted_constituency,
            contribution.submitted_county
          );

          if (constituencyId) {
            const { error: updateError } = await supabase
              .from('iebc_office_contributions')
              .update({ submitted_constituency_id: constituencyId })
              .eq('id', contribution.id);

            if (!updateError) {
              updatedCount++;
            } else {
              console.warn(`Failed to update contribution ${contribution.id}:`, updateError);
            }
          }
        } catch (contributionError) {
          console.warn(`Error processing contribution ${contribution.id}:`, contributionError);
        }
      }

      console.log(`Successfully updated ${updatedCount} contributions`);
      return { updated: updatedCount, total: contributions?.length || 0 };

    } catch (error) {
      console.error('Error updating constituency IDs:', error);
      throw error;
    }
  }, [getConstituencyId]);

  const updateOfficeConstituencyIds = useCallback(async () => {
    try {
      console.log('Updating constituency IDs in iebc_offices...');
      
      const { data: offices, error: officesError } = await supabase
        .from('iebc_offices')
        .select('id, constituency, county')
        .is('constituency_code', null)
        .not('constituency', 'is', null);

      if (officesError) {
        throw new Error(`Failed to fetch offices: ${officesError.message}`);
      }

      console.log(`Found ${offices?.length || 0} offices to update`);

      let updatedCount = 0;
      for (const office of offices || []) {
        try {
          const constituencyId = await getConstituencyId(
            office.constituency,
            office.county
          );

          if (constituencyId) {
            const { error: updateError } = await supabase
              .from('iebc_offices')
              .update({ constituency_code: constituencyId })
              .eq('id', office.id);

            if (!updateError) {
              updatedCount++;
            } else {
              console.warn(`Failed to update office ${office.id}:`, updateError);
            }
          }
        } catch (officeError) {
          console.warn(`Error processing office ${office.id}:`, officeError);
        }
      }

      console.log(`Successfully updated ${updatedCount} offices`);
      return { updated: updatedCount, total: offices?.length || 0 };

    } catch (error) {
      console.error('Error updating office constituency IDs:', error);
      throw error;
    }
  }, [getConstituencyId]);

  const getFallbackLandmarks = useCallback(async (latitude, longitude, radiusMeters) => {
    const fallbackLandmarks = [];

    try {
      const { data: officeData, error: officeError } = await supabase
        .from('iebc_offices')
        .select('*')
        .gte('latitude', latitude - 0.05)
        .lte('latitude', latitude + 0.05)
        .gte('longitude', longitude - 0.05)
        .lte('longitude', longitude + 0.05)
        .limit(20);

      if (!officeError && officeData && Array.isArray(officeData)) {
        const processedOffices = officeData
          .filter(office => office && office.latitude && office.longitude)
          .map(office => {
            const distance = calculateDistance(latitude, longitude, office.latitude, office.longitude);
            const bearing = calculateBearing(latitude, longitude, office.latitude, office.longitude);
            const qualityScore = calculateLandmarkQuality(office, distance, radiusMeters);

            return {
              landmark_id: office.id || `office_${Date.now()}`,
              landmark_name: office.office_name || 'IEBC Office',
              landmark_type: 'government',
              landmark_subtype: 'iebc_office',
              landmark_latitude: office.latitude,
              landmark_longitude: office.longitude,
              distance_meters: distance,
              bearing_degrees: bearing,
              triangulation_weight: 0.85,
              quality_score: qualityScore,
              direction_description: getDirectionFromBearing(bearing),
              side_of_road: determineSideOfRoad(latitude, office.latitude),
              typical_accuracy_meters: 15
            };
          });
        fallbackLandmarks.push(...processedOffices);
      }
    } catch (officeError) {
      console.warn('IEBC offices fallback failed:', officeError);
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
          // FIXED: Use correct table name and column names
          const { data: rpcData, error: rpcError } = await supabase
            .from('map_landmarks')
            .select('*')
            .gte('centroid_lat', latitude - 0.02)
            .lte('centroid_lat', latitude + 0.02)
            .gte('centroid_lng', longitude - 0.02)
            .lte('centroid_lng', longitude + 0.02)
            .limit(8);

          if (!rpcError && rpcData && rpcData.length > 0) {
            console.log(`Found ${rpcData.length} enhanced triangulation landmarks on attempt ${attempt + 1}`);
            landmarks = rpcData.map(landmark => ({
              ...landmark,
              landmark_latitude: landmark.centroid_lat,
              landmark_longitude: landmark.centroid_lng,
              landmark_name: landmark.name,
              landmark_type: landmark.landmark_type,
              triangulation_weight: 0.7
            }));
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

      let constituencyId = enrichedData.submitted_constituency_id;
      if (constituencyId && typeof constituencyId !== 'number') {
        console.warn('Constituency ID is not a number, converting:', constituencyId);
        constituencyId = parseInt(constituencyId);
        if (isNaN(constituencyId)) {
          console.warn('Failed to parse constituency ID as number, setting to null');
          constituencyId = null;
        }
      }

      // FIXED: Use correct column names that match database schema
      const contribution = {
        submitted_latitude: enrichedData.submitted_latitude,
        submitted_longitude: enrichedData.submitted_longitude,
        submitted_accuracy_meters: enrichedData.submitted_accuracy_meters || 50,
        submitted_office_location: enrichedData.submitted_office_location,
        submitted_county: enrichedData.submitted_county,
        submitted_constituency: enrichedData.submitted_constituency,
        submitted_constituency_id: constituencyId, // FIXED: Use correct column name
        submitted_constituency_code: constituencyId, // Keep both for compatibility
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
        constituencyId: data.submitted_constituency_id,
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
        .from('iebc_offices')
        .select('*')
        .gte('latitude', latitude - 0.01)
        .lte('latitude', latitude + 0.01)
        .gte('longitude', longitude - 0.01)
        .lte('longitude', longitude + 0.01)
        .limit(10);

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

      const now = Date.now();
      const lastSubmission = localStorage.getItem('last_submission_time');
      
      if (lastSubmission) {
        const timeSinceLast = now - parseInt(lastSubmission);
        if (timeSinceLast < 30000) {
          return { 
            allowed: false, 
            reason: 'RATE_LIMIT_EXCEEDED', 
            retry_after_seconds: Math.ceil((30000 - timeSinceLast) / 1000) 
          };
        }
      }

      localStorage.setItem('last_submission_time', now.toString());
      return { allowed: true, reason: 'OK', retry_after_seconds: 0 };

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
    enrichContributionData,
    getConstituencyId,
    updateExistingConstituencyIds,
    updateOfficeConstituencyIds
  };
};

export default useContributeLocation;
