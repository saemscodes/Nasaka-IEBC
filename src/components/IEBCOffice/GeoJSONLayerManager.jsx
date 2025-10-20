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
  liveOffices = []
}) => {
  const map = useMap();
  const [layerData, setLayerData] = useState({});
  const [loading, setLoading] = useState({});
  const geoJsonLayersRef = useRef({});

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
    'constituencies': {
      name: 'Constituency Boundaries',
      url: 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/constituencies.geojson',
      type: 'geojson',
      style: {
        color: '#059669',
        weight: 2,
        opacity: 0.7,
        fillColor: '#10b981',
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
    }
  }), [selectedOffice, liveOfficesGeoJSON]);

  const fetchLayerData = useCallback(async (layerId) => {
    if (layerData[layerId]) return;
    
    if (layerId === 'iebc-offices' && liveOfficesGeoJSON.features.length > 0) {
      setLayerData(prev => ({ ...prev, [layerId]: liveOfficesGeoJSON }));
      return;
    }
    
    setLoading(prev => ({ ...prev, [layerId]: true }));
    try {
      const config = layerConfigs[layerId];
      if (layerId === 'iebc-offices' && liveOfficesGeoJSON.features.length > 0) {
        setLayerData(prev => ({ ...prev, [layerId]: liveOfficesGeoJSON }));
        return;
      }
      
      const response = await fetch(config.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const geojson = await response.json();
      setLayerData(prev => ({ ...prev, [layerId]: geojson }));
    } catch (error) {
      console.error(`Error loading GeoJSON for ${layerId}:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [layerId]: false }));
    }
  }, [layerData, layerConfigs, liveOfficesGeoJSON]);

  const onEachFeature = useCallback((feature, layer) => {
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
  }, [onOfficeSelect, activeLayers, layerConfigs]);

  useEffect(() => {
    activeLayers.forEach(layerId => {
      if (layerConfigs[layerId]) {
        fetchLayerData(layerId);
      }
    });

    Object.keys(geoJsonLayersRef.current).forEach(layerId => {
      if (!activeLayers.includes(layerId) && geoJsonLayersRef.current[layerId]) {
        map.removeLayer(geoJsonLayersRef.current[layerId]);
        delete geoJsonLayersRef.current[layerId];
      }
    });
  }, [activeLayers, fetchLayerData, layerConfigs, map]);

  useEffect(() => {
    if (activeLayers.includes('iebc-offices') && liveOfficesGeoJSON.features.length > 0) {
      setLayerData(prev => ({
        ...prev,
        'iebc-offices': liveOfficesGeoJSON
      }));
    }
  }, [liveOfficesGeoJSON, activeLayers]);

  const createPopupContent = (properties, geometryCoords = null) => {
    const lat = properties.latitude || (geometryCoords ? geometryCoords[1] : null);
    const lng = properties.longitude || (geometryCoords ? geometryCoords[0] : null);
    
    const hasValidCoords = lat && lng && !isNaN(lat) && !isNaN(lng);
    
    return `
      <div class="min-w-[280px] p-3">
        <div class="flex items-start justify-between mb-2">
          <h3 class="font-semibold text-gray-900 text-base">${properties.constituency_name || 'IEBC Office'}</h3>
          ${properties.verified ? `<span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">Verified</span>` : ''}
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex items-center space-x-2 text-gray-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            </svg>
            <span>${properties.office_location || 'IEBC Office'}</span>
          </div>
          <div class="flex items-center space-x-2 text-gray-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-20 0h-5m9-18H9m0 0H7m2 0v4m0 4h10m-10 4h4m-4 4h6"/>
            </svg>
            <span>${properties.county} County</span>
          </div>
          ${properties.landmark ? `
            <div class="flex items-center space-x-2 text-gray-500 text-xs">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              </svg>
              <span>Near ${properties.landmark}</span>
            </div>
          ` : ''}
          ${hasValidCoords ? 
            `<div class="text-xs text-gray-400 font-mono">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>` : 
            `<div class="text-xs text-red-500">⚠️ Coordinates unavailable</div>`
          }
        </div>
        ${hasValidCoords ? `
          <div class="mt-4 space-y-2">
            <div class="text-xs font-medium text-gray-700 mb-2">Navigate via:</div>
            <div class="grid grid-cols-2 gap-2">
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving','_blank')" class="flex items-center justify-center space-x-1 bg-[#007AFF] text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-[#0A84FF] transition-colors" title="Navigate by car">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.78 9.44L17.94 4.44C17.8238 4.09604 17.6036 3.79671 17.3097 3.5835C17.0159 3.37029 16.663 3.25374 16.3 3.25H7.7C7.3418 3.2508 6.99248 3.36151 6.6992 3.56716C6.40592 3.77281 6.18281 4.06351 6.06 4.4L4.22 9.4C3.92473 9.54131 3.67473 9.76216 3.49808 10.0377C3.32142 10.3133 3.22512 10.6327 3.22 10.96V15.46C3.21426 15.7525 3.28279 16.0417 3.41921 16.3006C3.55562 16.5594 3.75544 16.7794 4 16.94V17V19C4 19.2652 4.10536 19.5196 4.29289 19.7071C4.48043 19.8946 4.73478 20 5 20H6C6.26522 20 6.51957 19.8946 6.70711 19.7071C6.89464 19.5196 7 19.2652 7 19V17.25H17V19C17 19.2652 17.1054 19.5196 17.2929 19.7071C17.4804 19.8946 17.7348 20 18 20H19C19.2652 20 19.5196 19.8946 19.7071 19.7071C19.8946 19.5196 20 19.2652 20 19V17C20 17 20 17 20 16.94C20.2351 16.7808 20.4275 16.5661 20.56 16.315C20.6925 16.0639 20.7612 15.784 20.76 15.5V11C20.7567 10.6748 20.6634 10.3569 20.4904 10.0815C20.3174 9.80616 20.0715 9.58411 19.78 9.44ZM19.25 15.5C19.25 15.5663 19.2237 15.6299 19.1768 15.6768C19.1299 15.7237 19.0663 15.75 19 15.75H5C4.93369 15.75 4.87011 15.7237 4.82322 15.6768C4.77634 15.6299 4.75 15.5663 4.75 15.5V11C4.75 10.9337 4.77634 10.8701 4.82322 10.8232C4.87011 10.7763 4.93369 10.75 5 10.75H19C19.0663 10.75 19.1299 10.7763 19.1768 10.8232C19.2237 10.8701 19.25 10.9337 19.25 11V15.5ZM7.47 4.91C7.48797 4.86341 7.51949 4.82327 7.56048 4.79475C7.60147 4.76624 7.65007 4.75065 7.7 4.75H16.3C16.3499 4.75065 16.3985 4.76624 16.4395 4.79475C16.4805 4.82327 16.512 4.86341 16.53 4.91L17.93 8.75H6.07L7.47 4.91Z"/>
                  <path d="M8 14.75C8.82843 14.75 9.5 14.0784 9.5 13.25C9.5 12.4216 8.82843 11.75 8 11.75C7.17157 11.75 6.5 12.4216 6.5 13.25C6.5 14.0784 7.17157 14.75 8 14.75Z"/>
                  <path d="M16 14.75C16.8284 14.75 17.5 14.0784 17.5 13.25C17.5 12.4216 16.8284 11.75 16 11.75C15.1716 11.75 14.5 12.4216 14.5 13.25C14.5 14.0784 15.1716 14.75 16 14.75Z"/>
                </svg>
                <span>Car</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking','_blank')" class="flex items-center justify-center space-x-1 bg-[#34C759] text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-[#30D158] transition-colors" title="Navigate on foot">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 512 512">
                  <path d="M278.796,94.952c26.218,0,47.472-21.254,47.472-47.481C326.268,21.254,305.014,0,278.796,0c-26.227,0-47.481,21.254-47.481,47.472C231.315,73.698,252.569,94.952,278.796,94.952z"/>
                  <path d="M407.86,236.772l-54.377-28.589l-22.92-47.087c-11.556-23.754-33.698-40.612-59.679-45.439l-23.58-4.386c-11.859-2.197-24.111-0.614-35.027,4.542l-68.67,32.426c-7.628,3.599-13.654,9.863-16.969,17.601l-30.539,71.308c-1.941,4.533-1.978,9.652-0.11,14.202c1.868,4.561,5.494,8.187,10.046,10.055l0.686,0.275c9.102,3.726,19.532-0.384,23.654-9.314l28.03-60.704l44.368-14.34l-43.964,195.39l-42.82,106.765c-2.372,5.916-2.106,12.555,0.715,18.26c2.82,5.714,7.938,9.954,14.074,11.667l1.85,0.512c9.844,2.747,20.293-1.511,25.42-10.357l50.751-87.663l30.237-59.998l55.182,60.896l40.76,86.354c4.596,9.734,15.466,14.834,25.887,12.133l0.458-0.128c6.053-1.566,11.163-5.586,14.13-11.09c2.94-5.504,3.47-11.996,1.438-17.903l-29.99-86.93c-4.212-12.225-10.457-23.644-18.47-33.79l-48.699-64.394l17.866-92.92l23.058,29.294c2.848,3.626,6.538,6.52,10.741,8.426l60.658,27.388c4.387,1.979,9.387,2.098,13.864,0.33c4.479-1.768,8.05-5.274,9.9-9.716l0.192-0.467C419.562,250.874,416.019,241.067,407.86,236.772z"/>
                </svg>
                <span>Walk</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=transit','_blank')" class="flex items-center justify-center space-x-1 bg-[#AF52DE] text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-[#BF5AF2] transition-colors" title="Navigate via public transport">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 64 64">
                  <path d="M52,0H12C5.375,0,0,5.371,0,12v40c0,2.211,1.789,4,4,4h4v4c0,2.211,1.789,4,4,4h4c2.211,0,4-1.789,4-4v-4h24v4c0,2.211,1.789,4,4,4h4c2.211,0,4-1.789,4-4v-4h4c2.211,0,4-1.789,4-4V12C64,5.375,58.629,0,52,0z M16,44c-2.211,0-4-1.789-4-4s1.789-4,4-4s4,1.789,4,4S18.211,44,16,44z M48,44c-2.211,0-4-1.789-4-4s1.789-4,4-4s4,1.789,4,4S50.211,44,48,44z M56,24H8V12c0-2.211,1.789-4,4-4h40c2.211,0,4,1.789,4,4V24z"/>
                </svg>
                <span>Transit</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling','_blank')" class="flex items-center justify-center space-x-1 bg-[#FF9500] text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-[#FF9F0A] transition-colors" title="Navigate by bicycle">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 512 512">
                  <path d="M488.649,180.545v-25.082c0,0-50.161-5.193-110.703,18.159c-60.542,23.352-104.649,17.3-110.703,11.243c-6.054-6.05-33.728-32.864-38.056-36.325c-4.323-3.455-12.974-17.294-22.486-8.647c-1.662,1.514-3.432,2.387-5.221,3.022l9.652-19.84c1.561-3.202,4.807-5.236,8.369-5.236h52.065c5.016,0,4.673-4.067,4.673-9.086c0-5.02,0.342-9.08-4.673-9.08h-52.065c-10.514,0-20.103,6-24.7,15.455l-11.946,24.556c-5.088-3.887-24.606-17.337-52.696-18.816v60.535c0,0,20.86-1.868,33.516-4.025l-14.654,24.672c-20.244-11.358-43.938-17.099-68.829-15.238c-19.056,1.414-36.768,7.147-52.255,16.14l5.736,17.207c12.66-6.592,26.831-10.788,41.972-11.914c24.751-1.846,45.419,2.005,62.774,11.655l-16.71,28.126c-10.875-4.962-22.922-7.804-35.658-7.804C38.525,240.221,0,278.745,0,326.271c0,47.525,38.525,86.057,86.053,86.057c47.524,0,86.053-38.532,86.053-86.057c0-27.347-12.797-51.664-32.683-67.422l15.93-26.821c16.096,14.698,28.63,36.174,38.377,64.833c0.328,0.974,11.625,10.659,11.675,11.684l1.435-3.13c1.476,27.722,23.211,28.212,23.211,28.212s56.215,0,81.297,0C342.486,215.138,467.893,186.595,488.649,180.545z M137.515,326.271c0,28.421-23.045,51.462-51.462,51.462c-28.421,0-51.463-23.041-51.463-51.462c0-28.414,23.042-51.463,51.463-51.463c6.274,0,12.263,1.183,17.824,3.238l-18.138,30.527c-9.645,0.173-17.42,8.012-17.42,17.697c0,9.793,7.94,17.733,17.734,17.733s17.73-7.94,17.73-17.733c0-2.005-0.408-3.908-1.024-5.712l18.736-31.529C131.346,298.404,137.515,311.602,137.515,326.271z M166.186,213.797l13.327-22.436c5.989,14.965,12.797,38.72,18.104,60.773C189.825,237.235,179.066,224.24,166.186,213.797z"/>
                  <path d="M425.947,240.221c-47.525,0-86.054,38.525-86.054,86.05c0,47.525,38.528,86.057,86.054,86.057c47.525,0,86.053-38.532,86.053-86.057C512,278.745,473.472,240.221,425.947,240.221z M425.947,377.733c-28.422,0-51.463-23.041-51.463-51.462c0-28.414,23.041-51.463,51.463-51.463c28.418,0,51.459,23.049,51.459,51.463C477.406,354.692,454.364,377.733,425.947,377.733z"/>
                  <path d="M425.947,308.545c-9.794,0-17.73,7.932-17.73,17.726c0,9.793,7.936,17.733,17.73,17.733c9.793,0,17.73-7.94,17.73-17.733C443.676,316.477,435.74,308.545,425.947,308.545z"/>
                </svg>
                <span>Bike</span>
              </button>
            </div>
            <button onclick="navigator.clipboard.writeText('${lat},${lng}').then(() => alert('Coordinates copied!'))" class="w-full mt-2 bg-[#8E8E93] text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-[#636366] transition-colors flex items-center justify-center space-x-1" title="Copy coordinates">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              <span>Copy Coordinates</span>
            </button>
          </div>
        ` : `
          <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            Location coordinates are not available for this office.
          </div>
        `}
      </div>
    `;
  };

  return (
    <>
      {activeLayers.map(layerId => {
        const config = layerConfigs[layerId];
        const data = layerData[layerId];
        
        if (!data || !config) return null;
        
        return (
          <GeoJSON
            key={layerId}
            data={data}
            style={config.style}
            pointToLayer={config.pointToLayer}
            onEachFeature={onEachFeature}
          />
        );
      })}
    </>
  );
};

export default GeoJSONLayerManager;
export { searchNearbyOffices, calculateDistance };
