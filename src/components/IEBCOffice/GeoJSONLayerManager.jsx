// src/components/IEBCOffice/GeoJSONLayerManager.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';

// Custom office marker icons
const createOfficeIcon = (isSelected = false) => {
  return L.divIcon({
    html: `
      <div class="relative">
        <div class="w-6 h-6 bg-primary rounded-full border-2 border-background shadow-lg flex items-center justify-center ${
          isSelected ? 'scale-125 ring-2 ring-primary ring-opacity-50' : ''
        }">
          <div class="w-2 h-2 bg-background rounded-full"></div>
        </div>
        ${isSelected ? '<div class="absolute inset-0 rounded-full bg-primary animate-ping opacity-20"></div>' : ''}
      </div>
    `,
    className: 'office-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const GeoJSONLayerManager = ({
  activeLayers,
  onOfficeSelect,
  selectedOffice,
  onNearbyOfficesFound,
  baseMap = 'standard'
}) => {
  const map = useMap();
  const [geoJsonLayers, setGeoJsonLayers] = useState({});
  const [officeMarkers, setOfficeMarkers] = useState([]);
  const layersRef = useRef({});
  const markersLayerRef = useRef(L.layerGroup());

  // Load GeoJSON data from Supabase storage
  const loadGeoJSONData = useCallback(async (layerName) => {
    try {
      const { data, error } = await supabase.storage
        .from('map-data')
        .download(`${layerName}.geojson`);

      if (error) throw error;

      const text = await data.text();
      return JSON.parse(text);
    } catch (error) {
      console.error(`Error loading ${layerName} GeoJSON:`, error);
      return null;
    }
  }, []);

  // Initialize layers
  useEffect(() => {
    markersLayerRef.current.addTo(map);
    
    return () => {
      markersLayerRef.current.clearLayers();
      Object.values(layersRef.current).forEach(layer => {
        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
    };
  }, [map]);

  // Handle office markers layer
  useEffect(() => {
    if (!activeLayers.includes('iebc-offices')) {
      markersLayerRef.current.clearLayers();
      setOfficeMarkers([]);
      return;
    }

    loadOfficeMarkers();
  }, [activeLayers, selectedOffice]);

  // Load office markers from Supabase
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

  // Handle constituency boundaries layer
  useEffect(() => {
    if (activeLayers.includes('constituencies')) {
      loadAndDisplayLayer('constituencies', {
        style: {
          color: '#059669',
          weight: 2,
          opacity: 0.7,
          fillColor: '#10b981',
          fillOpacity: 0.1
        }
      });
    } else {
      removeLayer('constituencies');
    }
  }, [activeLayers]);

  // Handle county boundaries layer
  useEffect(() => {
    if (activeLayers.includes('counties')) {
      loadAndDisplayLayer('counties', {
        style: {
          color: '#7c3aed',
          weight: 3,
          opacity: 0.8,
          fillColor: '#8b5cf6',
          fillOpacity: 0.1
        }
      });
    } else {
      removeLayer('counties');
    }
  }, [activeLayers]);

  // Load and display GeoJSON layer
  const loadAndDisplayLayer = async (layerName, options) => {
    if (layersRef.current[layerName] && map.hasLayer(layersRef.current[layerName])) {
      return; // Layer already loaded
    }

    const geoJsonData = await loadGeoJSONData(layerName);
    if (!geoJsonData) return;

    const layer = L.geoJSON(geoJsonData, {
      ...options,
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
          const popupContent = Object.keys(feature.properties)
            .map(key => `<strong>${key}:</strong> ${feature.properties[key]}`)
            .join('<br>');
          layer.bindPopup(popupContent);
        }
      }
    });

    layer.addTo(map);
    layersRef.current[layerName] = layer;
  };

  // Remove layer from map
  const removeLayer = (layerName) => {
    if (layersRef.current[layerName] && map.hasLayer(layersRef.current[layerName])) {
      map.removeLayer(layersRef.current[layerName]);
      delete layersRef.current[layerName];
    }
  };

  // Update marker selection
  useEffect(() => {
    officeMarkers.forEach(marker => {
      const office = marker.options.office;
      const isSelected = selectedOffice && selectedOffice.id === office?.id;
      
      marker.setIcon(createOfficeIcon(isSelected));
      
      if (isSelected) {
        marker.openPopup();
      }
    });
  }, [selectedOffice, officeMarkers]);

  return null;
};

export default GeoJSONLayerManager;

// Utility function for nearby office search
export const searchNearbyOffices = async (lat, lng, radius = 5000) => {
  try {
    const { data: offices, error } = await supabase
      .from('iebc_offices')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .eq('verified', true);

    if (error) throw error;

    // Simple distance calculation (for demo - in production use PostGIS)
    const nearbyOffices = offices.filter(office => {
      const distance = calculateDistance(lat, lng, office.latitude, office.longitude);
      return distance <= (radius / 1000); // Convert meters to km
    });

    return nearbyOffices;
  } catch (error) {
    console.error('Error searching nearby offices:', error);
    return [];
  }
};

// Helper function to calculate distance between two points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};
