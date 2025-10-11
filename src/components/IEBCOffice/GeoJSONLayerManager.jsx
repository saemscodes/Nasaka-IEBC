import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Search nearby offices using Supabase PostGIS
const searchNearbyOffices = async (lat, lng, radius = 5000, onNearbyOfficesFound = null) => {
  try {
    // Use PostGIS distance query for precise spatial search
    const { data: offices, error } = await supabase
      .from('iebc_offices')
      .select('*')
      .eq('verified', true)
      .filter('geom', 'not.is', null)
      .filter('latitude', 'not.is', null)
      .filter('longitude', 'not.is', null);

    if (error) throw error;

    // Calculate distances and filter
    const officesWithDistance = offices
      .map(office => {
        const distance = calculateDistance(lat, lng, office.latitude, office.longitude);
        return { ...office, distance };
      })
      .filter(office => office.distance <= (radius / 1000)) // Convert to km
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
  searchRadius = 5000, // meters
  onNearbyOfficesFound
}) => {
  const map = useMap();
  const [layerData, setLayerData] = useState({});
  const [loading, setLoading] = useState({});

  // GeoJSON layer configurations with public URLs
  const layerConfigs = useMemo(() => ({
    'iebc-offices': {
      name: 'IEBC Offices',
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
          icon: L.divIcon({
            className: `geojson-office-marker ${isSelected ? 'selected' : ''}`,
            html: `
              <div class="relative">
                ${isSelected ? `
                  <div class="absolute inset-0 bg-ios-red rounded-full animate-ping opacity-75"></div>
                  <div class="relative w-6 h-6 bg-ios-red rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                ` : `
                  <div class="w-5 h-5 bg-ios-blue rounded-full border-2 border-white shadow-md"></div>
                `}
              </div>
            `,
            iconSize: isSelected ? [24, 24] : [20, 20],
            iconAnchor: isSelected ? [12, 12] : [10, 10]
          })
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
            html: `
              <div class="w-4 h-4 bg-ios-green rounded-full border-2 border-white shadow-md"></div>
            `,
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
    }
  }), [selectedOffice]);

  // Fetch GeoJSON data
  const fetchLayerData = useCallback(async (layerId) => {
    if (layerData[layerId]) return;

    setLoading(prev => ({ ...prev, [layerId]: true }));
    try {
      const config = layerConfigs[layerId];
      const response = await fetch(config.url);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const geojson = await response.json();
      
      setLayerData(prev => ({
        ...prev,
        [layerId]: geojson
      }));
    } catch (error) {
      console.error(`Error loading GeoJSON for ${layerId}:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [layerId]: false }));
    }
  }, [layerData, layerConfigs]);

  // Enhanced popup content with Supabase data
  const onEachFeature = useCallback((feature, layer) => {
    if (feature.properties && (feature.properties.id || feature.properties.constituency_code)) {
      layer.on('click', async (e) => {
        try {
          let office;
          
          // Try to fetch from Supabase using available identifiers
          if (feature.properties.id) {
            const { data, error } = await supabase
              .from('iebc_offices')
              .select('*')
              .eq('id', feature.properties.id)
              .single();

            if (!error) office = data;
          }
          
          // Fallback to feature properties if Supabase fetch fails
          if (!office && feature.properties) {
            office = {
              id: feature.properties.id,
              constituency_name: feature.properties.constituency_name,
              office_location: feature.properties.office_location,
              county: feature.properties.county,
              constituency: feature.properties.constituency,
              constituency_code: feature.properties.constituency_code,
              latitude: feature.properties.latitude,
              longitude: feature.properties.longitude,
              landmark: feature.properties.landmark,
              verified: feature.properties.verified
            };
          }

          if (office && onOfficeSelect) {
            onOfficeSelect(office);
          }

          // Create enhanced popup content
          const popupContent = createPopupContent(office || feature.properties);
          layer.bindPopup(popupContent).openPopup();
        } catch (error) {
          console.error('Error fetching office details:', error);
          const popupContent = createPopupContent(feature.properties);
          layer.bindPopup(popupContent).openPopup();
        }
      });

      // Add hover effects
      layer.on('mouseover', function () {
        this.setStyle({
          weight: 3,
          opacity: 1
        });
      });

      layer.on('mouseout', function () {
        const layerId = activeLayers.find(l => layerData[l]?.features?.includes(feature));
        if (layerId && layerConfigs[layerId]) {
          this.setStyle(layerConfigs[layerId].style);
        }
      });
    }
  }, [onOfficeSelect, activeLayers, layerData, layerConfigs]);

  // Load data for active layers
  useEffect(() => {
    activeLayers.forEach(layerId => {
      if (layerConfigs[layerId]) {
        fetchLayerData(layerId);
      }
    });
  }, [activeLayers, fetchLayerData, layerConfigs]);

  // Helper function to create popup content
  const createPopupContent = (properties) => {
    return `
      <div class="min-w-[280px] p-3">
        <div class="flex items-start justify-between mb-2">
          <h3 class="font-semibold text-ios-gray-900 text-base">
            ${properties.constituency_name || 'IEBC Office'}
          </h3>
          ${properties.verified ? `
            <span class="bg-ios-green/20 text-ios-green text-xs px-2 py-1 rounded-full font-medium">
              Verified
            </span>
          ` : ''}
        </div>
        
        <div class="space-y-2 text-sm">
          <div class="flex items-center space-x-2 text-ios-gray-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span>${properties.office_location || 'IEBC Office'}</span>
          </div>
          
          <div class="flex items-center space-x-2 text-ios-gray-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>${properties.county} County</span>
          </div>

          ${properties.landmark ? `
            <div class="flex items-center space-x-2 text-ios-gray-500 text-xs">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>Near ${properties.landmark}</span>
            </div>
          ` : ''}
        </div>

        <div class="mt-4 flex space-x-2">
          <button 
            onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${properties.latitude},${properties.longitude}&travelmode=driving', '_blank')"
            class="flex-1 bg-ios-blue text-white py-2 px-4 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span>Navigate</span>
          </button>
          
          <button 
            onclick="navigator.clipboard.writeText('${properties.latitude},${properties.longitude}')"
            class="bg-ios-gray-200 text-ios-gray-700 py-2 px-3 rounded-xl text-sm font-medium hover:bg-gray-300 transition-colors"
            title="Copy coordinates"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
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

