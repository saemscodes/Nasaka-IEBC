// src/components/IEBCOffice/GeoJSONLayerManager.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const searchNearbyOffices = async (lat, lng, radius = 5000, onNearbyOfficesFound = null) => {
  try {
    const { data: offices, error } = await supabase
      .from('iebc_offices')
      .select('*')
      .eq('verified', true)
      .not('geom', 'is', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) throw error;

    const officesWithDistance = offices.map(office => {
      const distance = calculateDistance(lat, lng, office.latitude, office.longitude);
      return {
        ...office,
        distance
      };
    }).filter(office => office.distance <= (radius / 1000))
      .sort((a, b) => a.distance - b.distance);

    if (onNearbyOfficesFound) {
      onNearbyOfficesFound(officesWithDistance, { lat, lng, radius });
    }

    return officesWithDistance;
  } catch (error) {
    console.error('Error searching nearby offices:', error);
    return [];
  }
};

const GeoJSONLayerManager = ({ 
  activeLayers = [], 
  onOfficeSelect, 
  selectedOffice, 
  searchRadius = 5000,
  onNearbyOfficesFound, 
  baseMap = 'standard',
  liveOffices = [],
  isModalMap = false
}) => {
  const map = useMap();
  const [layerData, setLayerData] = useState({});
  const [loading, setLoading] = useState({});
  const [layerErrors, setLayerErrors] = useState({});
  const geoJsonLayersRef = useRef({});
  const layerCacheRef = useRef(new Map());

  const liveOfficesGeoJSON = useMemo(() => {
    if (!liveOffices || liveOffices.length === 0) {
      return {
        type: 'FeatureCollection',
        features: []
      };
    }

    return {
      type: 'FeatureCollection',
      features: liveOffices.map(office => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [office.longitude, office.latitude]
        },
        properties: {
          id: office.id,
          county: office.county,
          constituency_code: office.constituency_code,
          constituency: office.constituency,
          constituency_name: office.constituency_name,
          office_location: office.office_location,
          landmark: office.landmark,
          latitude: office.latitude,
          longitude: office.longitude,
          verified: office.verified,
          formatted_address: office.formatted_address,
          displayName: office.displayName
        }
      }))
    };
  }, [liveOffices]);

  const createOfficeIcon = (isSelected = false) => {
    return L.divIcon({
      html: `
        <div class="relative">
          <div class="w-6 h-6 bg-primary rounded-full border-2 border-background shadow-lg flex items-center justify-center ${isSelected ? 'scale-125 ring-2 ring-primary ring-opacity-50' : ''}">
            <div class="w-2 h-2 bg-background rounded-full"></div>
          </div>
          ${isSelected ? '<div class="absolute inset-0 rounded-full bg-primary animate-ping opacity-20"></div>' : ''}
        </div>
      `,
      className: `office-marker ${isSelected ? 'selected' : ''}`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  const validateGeoJSON = (geojson) => {
    if (!geojson || typeof geojson !== 'object') {
      throw new Error('Invalid GeoJSON: Not an object');
    }
    
    if (geojson.type !== 'FeatureCollection' && geojson.type !== 'Feature') {
      throw new Error(`Invalid GeoJSON type: ${geojson.type}. Expected FeatureCollection or Feature`);
    }
    
    if (geojson.type === 'FeatureCollection' && (!Array.isArray(geojson.features))) {
      throw new Error('Invalid FeatureCollection: features must be an array');
    }
    
    return true;
  };

  const layerConfigs = useMemo(() => ({
    'iebc-offices': {
      name: 'IEBC Offices',
      getData: () => liveOfficesGeoJSON,
      type: 'geojson',
      style: {
        color: '#007AFF',
        weight: 2,
        opacity: 0.8,
        fillColor: '#007AFF',
        fillOpacity: 0.4
      },
      pointToLayer: (feature, latlng) => {
        const isSelected = selectedOffice && selectedOffice.id === feature.properties.id;
        return L.marker(latlng, {
          icon: createOfficeIcon(isSelected)
        });
      }
    },
    'iebc-offices-static': {
      name: 'IEBC Offices (Static)',
      url: 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/iebc_offices.geojson',
      type: 'geojson',
      style: {
        color: '#007AFF',
        weight: 2,
        opacity: 0.8,
        fillColor: '#007AFF',
        fillOpacity: 0.4
      },
      pointToLayer: (feature, latlng) => {
        const isSelected = selectedOffice && selectedOffice.id === feature.properties.id;
        return L.marker(latlng, {
          icon: createOfficeIcon(isSelected)
        });
      }
    },
    'iebc-offices-rows': {
      name: 'IEBC Offices (Detailed)',
      url: 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/iebc_offices_rows.geojson',
      type: 'geojson',
      style: {
        color: '#34C759',
        weight: 2,
        opacity: 0.8,
        fillColor: '#34C759',
        fillOpacity: 0.4
      },
      pointToLayer: (feature, latlng) => {
        return L.marker(latlng, {
          icon: L.divIcon({
            className: 'geojson-office-marker-detailed',
            html: `<div class="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        });
      }
    },
    'kenya-counties': {
      name: 'Kenya Counties Voters Data',
      url: 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/FULL%20CORRECTED%20-%20Kenya%20Counties%20Voters%27%20Data.geojson',
      type: 'geojson',
      style: {
        color: '#8E8E93',
        weight: 1,
        opacity: 0.6,
        fillColor: '#8E8E93',
        fillOpacity: 0.1
      }
    },
    'healthcare-facilities': {
      name: 'Healthcare Facilities across the Country',
      url: 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/healthcare_facilities.geojson',
      type: 'geojson',
      style: {
        color: '#7c3aed',
        weight: 3,
        opacity: 0.8,
        fillColor: '#8b5cf6',
        fillOpacity: 0.1
      }
    },
    'constituencies': {
      name: 'Kenya Constituencies',
      description: 'Parliamentary and electoral boundaries across Kenya as defined by IEBC. Each polygon represents one constituency with its corresponding code and name.',
      url: 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/constituencies_with_centroids.geojson',
      type: 'geojson',
      style: {
        color: '#eab308',
        weight: 2,
        opacity: 0.8,
        fillColor: '#fde047',
        fillOpacity: 0.3
      },
    }
  }), [selectedOffice, liveOfficesGeoJSON]);

  const fetchLayerData = useCallback(async (layerId) => {
    if (layerData[layerId] || layerErrors[layerId]) return;
    
    if (layerId === 'iebc-offices' && liveOfficesGeoJSON.features.length > 0) {
      setLayerData(prev => ({ ...prev, [layerId]: liveOfficesGeoJSON }));
      return;
    }
    
    const cacheKey = `${layerId}-${Date.now()}`;
    if (layerCacheRef.current.has(layerId)) {
      const cachedData = layerCacheRef.current.get(layerId);
      if (cachedData && Date.now() - cachedData.timestamp < 300000) {
        setLayerData(prev => ({ ...prev, [layerId]: cachedData.data }));
        return;
      }
    }
    
    setLoading(prev => ({ ...prev, [layerId]: true }));
    try {
      const config = layerConfigs[layerId];
      
      if (layerId === 'iebc-offices' && liveOfficesGeoJSON.features.length > 0) {
        const data = liveOfficesGeoJSON;
        setLayerData(prev => ({ ...prev, [layerId]: data }));
        layerCacheRef.current.set(layerId, { data, timestamp: Date.now() });
        return;
      }
      
      if (!config?.url) {
        throw new Error(`No URL configured for layer: ${layerId}`);
      }

      console.log(`Fetching GeoJSON for ${layerId} from:`, config.url);
      
      const response = await fetch(config.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json,application/geo+json,text/plain,*/*'
        },
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      
      if (!text.trim()) {
        throw new Error('Empty response from server');
      }
      
      let geojson;
      try {
        geojson = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error(`Invalid JSON format: ${parseError.message}`);
      }
      
      validateGeoJSON(geojson);
      
      setLayerData(prev => ({ ...prev, [layerId]: geojson }));
      layerCacheRef.current.set(layerId, { data: geojson, timestamp: Date.now() });
      
      setLayerErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[layerId];
        return newErrors;
      });
      
      console.log(`Successfully loaded GeoJSON for ${layerId}`, geojson);
    } catch (error) {
      console.error(`Failed to load GeoJSON for ${layerId}:`, error.message);
      
      let userFriendlyError = error.message;
      if (error.message.includes('Failed to fetch')) {
        userFriendlyError = 'Network error: Unable to fetch data. Please check your connection.';
      } else if (error.message.includes('HTTP')) {
        userFriendlyError = `Server error: ${error.message}. Please try again later.`;
      } else if (error.message.includes('JSON')) {
        userFriendlyError = 'Data format error: Invalid data received from server.';
      }
      
      setLayerErrors(prev => ({ 
        ...prev, 
        [layerId]: userFriendlyError 
      }));
      
      setTimeout(() => {
        setLayerErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[layerId];
          return newErrors;
        });
      }, 10000);
    } finally {
      setLoading(prev => ({ ...prev, [layerId]: false }));
    }
  }, [layerData, layerConfigs, liveOfficesGeoJSON, layerErrors]);

  const onEachFeature = useCallback((feature, layer) => {
    if (isModalMap) {
      return;
    }

    if (feature.properties && (feature.properties.id || feature.properties.constituency_code)) {
      layer.on('click', async (e) => {
        try {
          let office;
          
          if (feature.properties.id) {
            const { data, error } = await supabase
              .from('iebc_offices')
              .select('*')
              .eq('id', feature.properties.id)
              .single();
            
            if (!error) office = data;
          }

          if (!office && feature.geometry && feature.geometry.coordinates) {
            const [lng, lat] = feature.geometry.coordinates;
            office = {
              id: feature.properties.id,
              constituency_name: feature.properties.constituency_name,
              office_location: feature.properties.office_location,
              county: feature.properties.county,
              constituency: feature.properties.constituency,
              constituency_code: feature.properties.constituency_code,
              latitude: lat,
              longitude: lng,
              landmark: feature.properties.landmark,
              verified: feature.properties.verified
            };
          }

          if (!office && feature.properties) {
            office = {
              id: feature.properties.id,
              constituency_name: feature.properties.constituency_name,
              office_location: feature.properties.office_location,
              county: feature.properties.county,
              constituency: feature.properties.constituency,
              constituency_code: feature.properties.constituency_code,
              latitude: feature.properties.latitude || (feature.geometry?.coordinates ? feature.geometry.coordinates[1] : null),
              longitude: feature.properties.longitude || (feature.geometry?.coordinates ? feature.geometry.coordinates[0] : null),
              landmark: feature.properties.landmark,
              verified: feature.properties.verified
            };
          }

          if (office && onOfficeSelect) {
            onOfficeSelect(office);
          }

          const popupContent = createPopupContent(office || feature.properties, feature.geometry?.coordinates);
          layer.bindPopup(popupContent, { maxWidth: 320 }).openPopup();
        } catch (error) {
          console.error('Error fetching office details:', error);
          const popupContent = createPopupContent(feature.properties, feature.geometry?.coordinates);
          layer.bindPopup(popupContent, { maxWidth: 320 }).openPopup();
        }
      });

      const originalStyle = layerConfigs[activeLayers[0]]?.style;

      layer.on('mouseover', function() {
        if (layer.setStyle) {
          layer.setStyle({
            weight: 3,
            opacity: 1
          });
        }
      });

      layer.on('mouseout', function() {
        if (layer.setStyle && originalStyle) {
          layer.setStyle(originalStyle);
        }
      });
    }
  }, [onOfficeSelect, activeLayers, layerConfigs, isModalMap]);

  useEffect(() => {
    if (isModalMap) {
      return;
    }

    activeLayers.forEach(layerId => {
      if (layerConfigs[layerId] && !layerErrors[layerId]) {
        fetchLayerData(layerId);
      }
    });

    Object.keys(geoJsonLayersRef.current).forEach(layerId => {
      if (!activeLayers.includes(layerId) && geoJsonLayersRef.current[layerId]) {
        map.removeLayer(geoJsonLayersRef.current[layerId]);
        delete geoJsonLayersRef.current[layerId];
      }
    });
  }, [activeLayers, fetchLayerData, layerConfigs, map, layerErrors, isModalMap]);

  useEffect(() => {
    if (isModalMap) return;

    if (activeLayers.includes('iebc-offices') && liveOfficesGeoJSON.features.length > 0) {
      setLayerData(prev => ({
        ...prev,
        'iebc-offices': liveOfficesGeoJSON
      }));
    }
  }, [liveOfficesGeoJSON, activeLayers, isModalMap]);

  const createPopupContent = (properties, geometryCoords = null) => {
    const lat = properties.latitude || (geometryCoords ? geometryCoords[1] : null);
    const lng = properties.longitude || (geometryCoords ? geometryCoords[0] : null);
    
    const hasValidCoords = lat && lng && !isNaN(lat) && !isNaN(lng);
    
    const popupStyles = `
      <style>
        .popup-container { 
          min-width: 280px; 
          padding: 12px; 
          font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
          color: #1f2937;
        }
        .dark .popup-container {
          color: #f9fafb;
        }
        .popup-header { 
          display: flex; 
          align-items: flex-start; 
          justify-content: space-between; 
          margin-bottom: 8px; 
        }
        .popup-title { 
          font-weight: 600; 
          color: #1f2937; 
          font-size: 16px; 
          margin: 0; 
        }
        .dark .popup-title {
          color: #f9fafb;
        }
        .popup-verified { 
          background: #dcfce7; 
          color: #166534; 
          font-size: 11px; 
          padding: 2px 8px; 
          border-radius: 12px; 
          font-weight: 500; 
        }
        .dark .popup-verified {
          background: #14532d;
          color: #bbf7d0;
        }
        .popup-details { 
          margin-top: 8px; 
        }
        .popup-detail { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          margin-bottom: 4px; 
          color: #4b5563; 
          font-size: 14px; 
        }
        .dark .popup-detail {
          color: #d1d5db;
        }
        .popup-coords { 
          font-size: 11px; 
          color: #9ca3af; 
          font-family: monospace; 
          margin-top: 4px; 
        }
        .dark .popup-coords {
          color: #6b7280;
        }
        .popup-error { 
          margin-top: 16px; 
          padding: 12px; 
          background: #fef2f2; 
          border: 1px solid #fecaca; 
          border-radius: 8px; 
          font-size: 11px; 
          color: #dc2626; 
        }
        .dark .popup-error {
          background: #7f1d1d;
          border-color: #f87171;
          color: #fca5a5;
        }
        .navigation-section { 
          margin-top: 16px; 
        }
        .navigation-title { 
          font-size: 11px; 
          font-weight: 600; 
          color: #374151; 
          margin-bottom: 8px; 
        }
        .dark .navigation-title {
          color: #d1d5db;
        }
        .navigation-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 8px; 
        }
        .nav-button { 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          gap: 4px; 
          padding: 8px 12px; 
          border: none; 
          border-radius: 8px; 
          font-size: 11px; 
          font-weight: 500; 
          color: white; 
          cursor: pointer; 
          transition: all 0.2s ease; 
          text-decoration: none; 
        }
        .nav-button:hover { 
          opacity: 0.9; 
          transform: translateY(-1px);
        }
        .copy-button { 
          width: 100%; 
          margin-top: 8px; 
          padding: 8px 12px; 
          border: none; 
          border-radius: 8px; 
          font-size: 11px; 
          font-weight: 500; 
          color: white; 
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          gap: 4px; 
          transition: all 0.2s ease; 
        }
        .copy-button:hover { 
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .icon { 
          width: 16px; 
          height: 16px; 
        }
        
        .nav-button.car { background: #007AFF; }
        .nav-button.walk { background: #34C759; }
        .nav-button.transit { background: #AF52DE; }
        .nav-button.bike { background: #FF9500; }
        .copy-button { background: #8E8E93; }
        
        .dark .nav-button.car { background: #0056CC; }
        .dark .nav-button.walk { background: #2AA44F; }
        .dark .nav-button.transit { background: #8E44CD; }
        .dark .nav-button.bike { background: #E68500; }
        .dark .copy-button { background: #636366; }
        
        .nav-button .icon,
        .copy-button .icon {
          fill: #ffffff;
        }
      </style>
    `;

    return `
      ${popupStyles}
      <div class="popup-container">
        <div class="popup-header">
          <h3 class="popup-title">${properties.constituency_name || 'IEBC Office'}</h3>
          ${properties.verified ? `<span class="popup-verified">Verified</span>` : ''}
        </div>
        <div class="popup-details">
          <div class="popup-detail">
            <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
            </svg>
            <span>${properties.office_location || 'IEBC Office'}</span>
          </div>
          <div class="popup-detail">
            <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-20 0h-5m9-18H9m0 0H7m0 4v4m0 4h10m-10 4h4m-4 4h6"/>
            </svg>
            <span>${properties.county} County</span>
          </div>
          ${properties.landmark ? `
            <div class="popup-detail">
              <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
              </svg>
              <span>Near ${properties.landmark}</span>
            </div>
          ` : ''}
          ${hasValidCoords ? 
            `<div class="popup-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>` : 
            `<div class="popup-error">⚠️ Coordinates unavailable</div>`
          }
        </div>
        ${hasValidCoords ? `
          <div class="navigation-section">
            <div class="navigation-title">Navigate via:</div>
            <div class="navigation-grid">
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving','_blank')" class="nav-button car" title="Navigate by car">
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M19.78 9.44L17.94 4.44C17.8238 4.09604 17.6036 3.79671 17.3097 3.5835C17.0159 3.37029 16.663 3.25374 16.3 3.25H7.7C7.3418 3.2508 6.99248 3.36151 6.6992 3.56716C6.40592 3.77281 6.18281 4.06351 6.06 4.4L4.22 9.4C3.92473 9.54131 3.67473 9.76216 3.49808 10.0377C3.32142 10.3133 3.22512 10.6327 3.22 10.96V15.46C3.21426 15.7525 3.28279 16.0417 3.41921 16.3006C3.55562 16.5594 3.75544 16.7794 4 16.94V17V19C4 19.2652 4.10536 19.5196 4.29289 19.7071C4.48043 19.8946 4.73478 20 5 20H6C6.26522 20 6.51957 19.8946 6.70711 19.7071C6.89464 19.5196 7 19.2652 7 19V17.25H17V19C17 19.2652 17.1054 19.5196 17.2929 19.7071C17.4804 19.8946 17.7348 20 18 20H19C19.2652 20 19.5196 19.8946 19.7071 19.7071C19.8946 19.5196 20 19.2652 20 19V17C20 17 20 17 20 16.94C20.2351 16.7808 20.4275 16.5661 20.56 16.315C20.6925 16.0639 20.7612 15.784 20.76 15.5V11C20.7567 10.6748 20.6634 10.3569 20.4904 10.0815C20.3174 9.80616 20.0715 9.58411 19.78 9.44ZM19.25 15.5C19.25 15.5663 19.2237 15.6299 19.1768 15.6768C19.1299 15.7237 19.0663 15.75 19 15.75H5C4.93369 15.75 4.87011 15.7237 4.82322 15.6768C4.77634 15.6299 4.75 15.5663 4.75 15.5V11C4.75 10.9337 4.77634 10.8701 4.82322 10.8232C4.87011 10.7763 4.93369 10.75 5 10.75H19C19.0663 10.75 19.1299 10.7763 19.1768 10.8232C19.2237 10.8701 19.25 10.9337 19.25 11V15.5ZM7.47 4.91C7.48797 4.86341 7.51949 4.82327 7.56048 4.79475C7.60147 4.76624 7.65007 4.75065 7.7 4.75H16.3C16.3499 4.75065 16.3985 4.76624 16.4395 4.79475C16.4805 4.82327 16.512 4.86341 16.53 4.91L17.93 8.75H6.07L7.47 4.91Z"/>
                  <circle cx="8" cy="14" r="1.5" fill="white"/>
                  <circle cx="16" cy="14" r="1.5" fill="white"/>
                </svg>
                <span>Car</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking','_blank')" class="nav-button walk" title="Navigate on foot">
                <svg class="icon" viewBox="0 0 512 512">
                  <path d="M278.796,94.952c26.218,0,47.472-21.254,47.472-47.481C326.268,21.254,305.014,0,278.796,0c-26.227,0-47.481,21.254-47.481,47.472C231.315,73.698,252.569,94.952,278.796,94.952z"/>
                  <path d="M407.86,236.772l-54.377-28.589l-22.92-47.087c-11.556-23.754-33.698-40.612-59.679-45.439l-23.58-4.386c-11.859-2.197-24.111-0.614-35.027,4.542l-68.67,32.426c-7.628,3.599-13.654,9.863-16.969,17.601l-30.539,71.308c-1.941,4.533-1.978,9.652-0.11,14.202c1.868,4.561,5.494,8.187,10.046,10.055l0.686,0.275c9.102,3.726,19.532-0.384,23.654-9.314l28.03-60.704l44.368-14.34l-43.964,195.39l-42.82,106.765c-2.372,5.916-2.106,12.555,0.715,18.26c2.82,5.714,7.938,9.954,14.074,11.667l1.85,0.512c9.844,2.747,20.293-1.511,25.42-10.357l50.751-87.663l30.237-59.998l55.182,60.896l40.76,86.354c4.596,9.734,15.466,14.834,25.887,12.133l0.458-0.128c6.053-1.566,11.163-5.586,14.13-11.09c2.94-5.504,3.47-11.996,1.438-17.903l-29.99-86.93c-4.212-12.225-10.457-23.644-18.47-33.79l-48.699-64.394l17.866-92.92l23.058,29.294c2.848,3.626,6.538,6.52,10.741,8.426l60.658,27.388c4.387,1.979,9.387,2.098,13.864,0.33c4.479-1.768,8.05-5.274,9.9-9.716l0.192-0.467C419.562,250.874,416.019,241.067,407.86,236.772z"/>
                </svg>
                <span>Walk</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=transit','_blank')" class="nav-button transit" title="Navigate via public transport">
                <svg class="icon" viewBox="0 0 64 64">
                  <path d="M52,0H12C5.375,0,0,5.371,0,12v40c0,2.211,1.789,4,4,4h4v4c0,2.211,1.789,4,4,4h4c2.211,0,4-1.789,4-4v-4h24v4c0,2.211,1.789,4,4,4h4c2.211,0,4-1.789,4-4v-4h4c2.211,0,4-1.789,4-4V12C64,5.375,58.629,0,52,0z M16,44c-2.211,0-4-1.789-4-4s1.789-4,4-4s4,1.789,4,4S18.211,44,16,44z M48,44c-2.211,0-4-1.789-4-4s1.789-4,4-4s4,1.789,4,4S50.211,44,48,44z M56,24H8V12c0-2.211,1.789-4,4-4h40c2.211,0,4,1.789,4,4V24z"/>
                </svg>
                <span>Transit</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling','_blank')" class="nav-button bike" title="Navigate by bicycle">
                <svg class="icon" viewBox="0 0 512 512">
                  <path d="M488.649,180.545v-25.082c0,0-50.161-5.193-110.703,18.159c-60.542,23.352-104.649,17.3-110.703,11.243c-6.054-6.05-33.728-32.864-38.056-36.325c-4.323-3.455-12.974-17.294-22.486-8.647c-1.662,1.514-3.432,2.387-5.221,3.022l9.652-19.84c1.561-3.202,4.807-5.236,8.369-5.236h52.065c5.016,0,4.673-4.067,4.673-9.086c0-5.02,0.342-9.08-4.673-9.08h-52.065c-10.514,0-20.103,6-24.7,15.455l-11.946,24.556c-5.088-3.887-24.606-17.337-52.696-18.816v60.535c0,0,20.86-1.868,33.516-4.025l-14.654,24.672c-20.244-11.358-43.938-17.099-68.829-15.238c-19.056,1.414-36.768,7.147-52.255,16.14l5.736,17.207c12.66-6.592,26.831-10.788,41.972-11.914c24.751-1.846,45.419,2.005,62.774,11.655l-16.71,28.126c-10.875-4.962-22.922-7.804-35.658-7.804C38.525,240.221,0,278.745,0,326.271c0,47.525,38.525,86.057,86.053,86.057c47.524,0,86.053-38.532,86.053-86.057c0-27.347-12.797-51.664-32.683-67.422l15.93-26.821c16.096,14.698,28.63,36.174,38.377,64.833c0.328,0.974,11.625,10.659,11.675,11.684l1.435-3.13c1.476,27.722,23.211,28.212,23.211,28.212s56.215,0,81.297,0C342.486,215.138,467.893,186.595,488.649,180.545z M137.515,326.271c0,28.421-23.045,51.462-51.462,51.462c-28.421,0-51.463-23.041-51.463-51.462c0-28.414,23.042-51.463,51.463-51.463c6.274,0,12.263,1.183,17.824,3.238l-18.138,30.527c-9.645,0.173-17.42,8.012-17.42,17.697c0,9.793,7.94,17.733,17.734,17.733s17.73-7.94,17.73-17.733c0-2.005-0.408-3.908-1.024-5.712l18.736-31.529C131.346,298.404,137.515,311.602,137.515,326.271z M166.186,213.797l13.327-22.436c5.989,14.965,12.797,38.72,18.104,60.773C189.825,237.235,179.066,224.24,166.186,213.797z"/>
                  <path d="M425.947,240.221c-47.525,0-86.054,38.525-86.054,86.05c0,47.525,38.528,86.057,86.054,86.057c47.525,0,86.053-38.532,86.053-86.057C512,278.745,473.472,240.221,425.947,240.221z M425.947,377.733c-28.422,0-51.463-23.041-51.463-51.462c0-28.414,23.041-51.463,51.463-51.463c28.418,0,51.459,23.049,51.459,51.463C477.406,354.692,454.364,377.733,425.947,377.733z"/>
                  <circle cx="425.947" cy="326.271" r="17.73"/>
                </svg>
                <span>Bike</span>
              </button>
            </div>
            <button onclick="navigator.clipboard.writeText('${lat},${lng}').then(() => alert('Coordinates copied!'))" class="copy-button" title="Copy coordinates">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
              <span>Copy Coordinates</span>
            </button>
          </div>
        ` : `
          <div class="popup-error">
            Location coordinates are not available for this office.
          </div>
        `}
      </div>
    `;
  };

  const ErrorDisplay = ({ layerId }) => {
    const error = layerErrors[layerId];
    if (!error) return null;

    return (
      <div className="error-notification layer-error">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm font-medium">Failed to load {layerConfigs[layerId]?.name}</span>
        </div>
        <p className="text-xs mt-1 opacity-90">{error}</p>
      </div>
    );
  };

  if (isModalMap) {
    return (
      <>
        {activeLayers.includes('iebc-offices') && (
          <GeoJSON
            key="modal-iebc-offices"
            data={liveOfficesGeoJSON}
            style={{
              color: '#007AFF',
              weight: 2,
              opacity: 0.8,
              fillColor: '#007AFF',
              fillOpacity: 0.4
            }}
            pointToLayer={(feature, latlng) => {
              return L.marker(latlng, {
                icon: L.divIcon({
                  className: 'modal-office-marker',
                  html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })
              });
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      {activeLayers.map(layerId => {
        const config = layerConfigs[layerId];
        const data = layerData[layerId];
        const error = layerErrors[layerId];
        const isLoading = loading[layerId];
        
        if (!config) return null;
        
        return (
          <div key={layerId}>
            {isLoading && (
              <div className="loading-indicator">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Loading {config.name}...</span>
                </div>
              </div>
            )}
            
            <ErrorDisplay layerId={layerId} />
            
            {data && !error && (
              <GeoJSON
                key={`${layerId}-${Object.keys(data).length}`}
                data={data}
                style={config.style}
                pointToLayer={config.pointToLayer}
                onEachFeature={onEachFeature}
              />
            )}
          </div>
        );
      })}
    </>
  );
};

export default GeoJSONLayerManager;
export { searchNearbyOffices, calculateDistance };
