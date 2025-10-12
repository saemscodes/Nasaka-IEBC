// src/components/IEBCOffice/GeoJSONLayerManager.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { GeoJSON, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
    const { data: offices, error } = await supabase
      .from('iebc_offices')
      .select('*')
      .eq('verified', true)
      .not('geom', 'is', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) throw error;

    // Calculate distances and filter by radius
    const officesWithDistance = offices
      .map(office => {
        const distance = calculateDistance(lat, lng, office.latitude, office.longitude);
        return { ...office, distance };
      })
      .filter(office => office.distance <= (radius / 1000)) // Convert meters to km
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

// Custom office marker icons
const createOfficeIcon = (isSelected = false) => {
  return L.divIcon({
    html: `
      <div class="relative">
        <div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${
          isSelected ? 'scale-125 ring-2 ring-blue-500 ring-opacity-50' : ''
        }">
          <div class="w-2 h-2 bg-white rounded-full"></div>
        </div>
        ${isSelected ? '<div class="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20"></div>' : ''}
      </div>
    `,
    className: `geojson-office-marker ${isSelected ? 'selected' : ''}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const GeoJSONLayerManager = ({ 
  activeLayers = [],
  onOfficeSelect,
  selectedOffice,
  searchRadius = 5000, // meters
  onNearbyOfficesFound,
  baseMap = 'standard'
}) => {
  const map = useMap();
  const [layerData, setLayerData] = useState({});
  const [loading, setLoading] = useState({});
  const [officeMarkers, setOfficeMarkers] = useState([]);
  const markersLayerRef = useRef(L.layerGroup());

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
          icon: createOfficeIcon(isSelected)
        });
      }
    },
    'constituencies': {
      name: 'Constituencies',
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
    'counties': {
      name: 'Counties',
      url: 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/counties.geojson',
      type: 'geojson',
      style: {
        color: '#7c3aed',
        weight: 3,
        opacity: 0.8,
        fillColor: '#8b5cf6',
        fillOpacity: 0.1
      }
    }
  }), [selectedOffice]);

  // Initialize markers layer
  useEffect(() => {
    markersLayerRef.current.addTo(map);
    
    return () => {
      markersLayerRef.current.clearLayers();
    };
  }, [map]);

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
          
          // Fallback: Try to get from GeoJSON geometry coordinates
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
          
          // Final fallback to feature properties
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

          // Create enhanced popup content
          const popupContent = createPopupContent(office || feature.properties, feature.geometry?.coordinates);
          layer.bindPopup(popupContent, { maxWidth: 320 }).openPopup();
        } catch (error) {
          console.error('Error fetching office details:', error);
          const popupContent = createPopupContent(feature.properties, feature.geometry?.coordinates);
          layer.bindPopup(popupContent, { maxWidth: 320 }).openPopup();
        }
      });

      // Store the original layer ID for this feature
      const layerId = activeLayers.find(l => layerData[l]?.features?.includes(feature));
      const originalStyle = layerId && layerConfigs[layerId] ? layerConfigs[layerId].style : null;

      // Mouseover event
      layer.on('mouseover', function () {
        if (layer.setStyle) {
          layer.setStyle({
            weight: 3,
            opacity: 1
          });
        }
      });

      // Mouseout event
      layer.on('mouseout', function () {
        if (originalStyle && layer.setStyle) {
          layer.setStyle(originalStyle);
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

  // Load office markers directly from Supabase for better performance
  useEffect(() => {
    if (!activeLayers.includes('iebc-offices')) {
      markersLayerRef.current.clearLayers();
      setOfficeMarkers([]);
      return;
    }

    loadOfficeMarkers();
  }, [activeLayers, selectedOffice]);

  const loadOfficeMarkers = async () => {
    try {
      const { data: offices, error } = await supabase
        .from('iebc_offices')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .eq('verified', true);

      if (error) throw error;

      markersLayerRef.current.clearLayers();

      const markers = offices.map(office => {
        const isSelected = selectedOffice && selectedOffice.id === office.id;
        const marker = L.marker([office.latitude, office.longitude], {
          icon: createOfficeIcon(isSelected)
        });

        marker.bindPopup(`
          <div class="p-2 min-w-[200px]">
            <h3 class="font-semibold text-foreground">${office.constituency_name || 'IEBC Office'}</h3>
            <p class="text-sm text-muted-foreground mt-1">${office.county}</p>
            ${office.office_location ? `<p class="text-xs text-muted-foreground mt-1">${office.office_location}</p>` : ''}
            <button 
              onclick="window.selectOffice && window.selectOffice(${office.id})"
              class="w-full mt-2 px-3 py-1 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors"
            >
              View Details
            </button>
          </div>
        `);

        marker.on('click', () => {
          onOfficeSelect(office);
        });

        return marker;
      });

      markers.forEach(marker => markersLayerRef.current.addLayer(marker));
      setOfficeMarkers(markers);

      // Expose function for popup buttons
      window.selectOffice = (officeId) => {
        const office = offices.find(o => o.id === officeId);
        if (office) onOfficeSelect(office);
      };

    } catch (error) {
      console.error('Error loading office markers:', error);
    }
  };

  // Helper function to create popup content with transport mode selection
  const createPopupContent = (properties, geometryCoords = null) => {
    // Extract latitude and longitude from multiple possible sources
    const lat = properties.latitude || (geometryCoords ? geometryCoords[1] : null);
    const lng = properties.longitude || (geometryCoords ? geometryCoords[0] : null);
    
    // Check if coordinates are valid
    const hasValidCoords = lat && lng && !isNaN(lat) && !isNaN(lng);
    
    return `
      <div class="min-w-[280px] p-3">
        <div class="flex items-start justify-between mb-2">
          <h3 class="font-semibold text-foreground text-base">
            ${properties.constituency_name || 'IEBC Office'}
          </h3>
          ${properties.verified ? `
            <span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
              Verified
            </span>
          ` : ''}
        </div>
        
        <div class="space-y-2 text-sm">
          <div class="flex items-center space-x-2 text-muted-foreground">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span>${properties.office_location || 'IEBC Office'}</span>
          </div>
          
          <div class="flex items-center space-x-2 text-muted-foreground">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>${properties.county} County</span>
          </div>

          ${properties.landmark ? `
            <div class="flex items-center space-x-2 text-muted-foreground text-xs">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>Near ${properties.landmark}</span>
            </div>
          ` : ''}
          
          ${hasValidCoords ? `
            <div class="text-xs text-muted-foreground font-mono">
              ${lat.toFixed(6)}, ${lng.toFixed(6)}
            </div>
          ` : `
            <div class="text-xs text-destructive">
              ⚠️ Coordinates unavailable
            </div>
          `}
        </div>

        ${hasValidCoords ? `
          <div class="mt-4 space-y-2">
            <div class="text-xs font-medium text-foreground mb-2">Navigate via:</div>
            <div class="grid grid-cols-2 gap-2">
              <button 
                onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving', '_blank')"
                class="flex items-center justify-center space-x-1 bg-blue-500 text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors"
                title="Navigate by car"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span>Car</span>
              </button>
              
              <button 
                onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking', '_blank')"
                class="flex items-center justify-center space-x-1 bg-green-500 text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-green-600 transition-colors"
                title="Navigate on foot"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Walk</span>
              </button>
              
              <button 
                onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=transit', '_blank')"
                class="flex items-center justify-center space-x-1 bg-purple-500 text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-purple-600 transition-colors"
                title="Navigate via public transport"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                <span>Transit</span>
              </button>
              
              <button 
                onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling', '_blank')"
                class="flex items-center justify-center space-x-1 bg-orange-500 text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors"
                title="Navigate by bicycle"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12a9 9 0 0118 0 9 9 0 01-18 0z" />
                </svg>
                <span>Bike</span>
              </button>
            </div>
            
            <button 
              onclick="navigator.clipboard.writeText('${lat},${lng}').then(() => alert('Coordinates copied!'))"
              class="w-full mt-2 bg-muted text-foreground py-2 px-3 rounded-lg text-xs font-medium hover:bg-muted/80 transition-colors flex items-center justify-center space-x-1"
              title="Copy coordinates"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy Coordinates</span>
            </button>
          </div>
        ` : `
          <div class="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
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
        
        if (!data || !config || layerId === 'iebc-offices') return null;

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
