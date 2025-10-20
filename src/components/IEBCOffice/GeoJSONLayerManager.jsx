// src/components/IEBCOffice/GeoJSONLayerManager.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';

delete L.Icon.Default.prototype._getIconUrl';
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
    
    // Simple inline styles for Leaflet popup
    const popupStyles = `
      <style>
        .popup-container { min-width: 280px; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        .popup-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
        .popup-title { font-weight: 600; color: #1f2937; font-size: 16px; margin: 0; }
        .popup-verified { background: #dcfce7; color: #166534; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 500; }
        .popup-details { margin-top: 8px; }
        .popup-detail { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; color: #4b5563; font-size: 14px; }
        .popup-coords { font-size: 11px; color: #9ca3af; font-family: monospace; margin-top: 4px; }
        .popup-error { margin-top: 16px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 11px; color: #dc2626; }
        .navigation-section { margin-top: 16px; }
        .navigation-title { font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 8px; }
        .navigation-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .nav-button { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 12px; border: none; border-radius: 8px; font-size: 11px; font-weight: 500; color: white; cursor: pointer; transition: background-color 0.2s; text-decoration: none; }
        .nav-button:hover { opacity: 0.9; }
        .copy-button { width: 100%; margin-top: 8px; padding: 8px 12px; background: #6b7280; border: none; border-radius: 8px; font-size: 11px; font-weight: 500; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: background-color 0.2s; }
        .copy-button:hover { background: #4b5563; }
        .icon { width: 12px; height: 12px; }
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
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            </svg>
            <span>${properties.office_location || 'IEBC Office'}</span>
          </div>
          <div class="popup-detail">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-20 0h-5m9-18H9m0 0H7m2 0v4m0 4h10m-10 4h4m-4 4h6"/>
            </svg>
            <span>${properties.county} County</span>
          </div>
          ${properties.landmark ? `
            <div class="popup-detail" style="color: #6b7280; font-size: 12px;">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              </svg>
              <span>Near ${properties.landmark}</span>
            </div>
          ` : ''}
          ${hasValidCoords ? 
            `<div class="popup-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>` : 
            `<div style="font-size: 11px; color: #dc2626;">⚠️ Coordinates unavailable</div>`
          }
        </div>
        ${hasValidCoords ? `
          <div class="navigation-section">
            <div class="navigation-title">Navigate via:</div>
            <div class="navigation-grid">
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving','_blank')" class="nav-button" style="background: #007AFF;" title="Navigate by car">
                <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                </svg>
                <span>Car</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking','_blank')" class="nav-button" style="background: #34C759;" title="Navigate on foot">
                <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.56-.89-1.68-1.25-2.65-.84L6 8.3V13h2V9.6l1.8-.7"/>
                </svg>
                <span>Walk</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=transit','_blank')" class="nav-button" style="background: #AF52DE;" title="Navigate via public transport">
                <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
                </svg>
                <span>Transit</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling','_blank')" class="nav-button" style="background: #FF9500;" title="Navigate by bicycle">
                <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
                </svg>
                <span>Bike</span>
              </button>
            </div>
            <button onclick="navigator.clipboard.writeText('${lat},${lng}').then(() => alert('Coordinates copied!'))" class="copy-button" title="Copy coordinates">
              <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
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
