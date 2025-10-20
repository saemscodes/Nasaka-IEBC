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
      <div style="min-width: 280px; padding: 12px;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px;">
          <h3 style="font-weight: 600; color: #1f2937; font-size: 16px; margin: 0;">${properties.constituency_name || 'IEBC Office'}</h3>
          ${properties.verified ? `<span style="background: #d1fae5; color: #065f46; font-size: 11px; padding: 4px 8px; border-radius: 12px; font-weight: 500;">Verified</span>` : ''}
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px;">
          <div style="display: flex; align-items: center; gap: 8px; color: #4b5563;">
            <span style="font-size: 16px;">📍</span>
            <span>${properties.office_location || 'IEBC Office'}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: #4b5563;">
            <span style="font-size: 16px;">🏛️</span>
            <span>${properties.county} County</span>
          </div>
          ${properties.landmark ? `
            <div style="display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 12px;">
              <span style="font-size: 14px;">📌</span>
              <span>Near ${properties.landmark}</span>
            </div>
          ` : ''}
          ${hasValidCoords ? 
            `<div style="font-size: 11px; color: #9ca3af; font-family: monospace;">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>` : 
            `<div style="font-size: 11px; color: #dc2626;">⚠️ Coordinates unavailable</div>`
          }
        </div>
        ${hasValidCoords ? `
          <div style="margin-top: 16px;">
            <div style="font-size: 11px; font-weight: 500; color: #374151; margin-bottom: 8px;">Navigate via:</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving','_blank')" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #3b82f6; color: white; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 500; border: none; cursor: pointer;" title="Navigate by car">
                <span style="font-size: 16px;">🚗</span>
                <span>Car</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking','_blank')" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #10b981; color: white; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 500; border: none; cursor: pointer;" title="Navigate on foot">
                <span style="font-size: 16px;">🚶</span>
                <span>Walk</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=transit','_blank')" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #8b5cf6; color: white; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 500; border: none; cursor: pointer;" title="Navigate via public transport">
                <span style="font-size: 16px;">🚌</span>
                <span>Transit</span>
              </button>
              <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling','_blank')" style="display: flex; align-items: center; justify-content: center; gap: 4px; background: #f59e0b; color: white; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 500; border: none; cursor: pointer;" title="Navigate by bicycle">
                <span style="font-size: 16px;">🏍️</span>
                <span>Bike</span>
              </button>
            </div>
            <button onclick="navigator.clipboard.writeText('${lat},${lng}').then(() => alert('Coordinates copied!'))" style="width: 100%; margin-top: 8px; background: #f3f4f6; color: #374151; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 500; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;" title="Copy coordinates">
              <span style="font-size: 14px;">📋</span>
              <span>Copy Coordinates</span>
            </button>
          </div>
        ` : `
          <div style="margin-top: 16px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 11px; color: #991b1b;">
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
