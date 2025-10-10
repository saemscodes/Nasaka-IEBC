import React, { useEffect, useState, useCallback } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';

const GeoJSONLayerManager = ({ 
  activeLayers = [],
  onOfficeSelect,
  selectedOffice 
}) => {
  const map = useMap();
  const [layerData, setLayerData] = useState({});
  const [loading, setLoading] = useState(false);

  // GeoJSON layer configurations
  const layerConfigs = {
    'iebc-offices': {
      name: 'IEBC Offices',
      url: 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/sign/map-data/iebc_offices.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kN2NhMTc4OC1jOGY0LTQzNTYtODRiNy1lMzA0ODJiMjcyMzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXAtZGF0YS9pZWJjX29mZmljZXMuZ2VvanNvbiIsImlhdCI6MTc2MDEzMjI2OCwiZXhwIjoyNTQ4NTMyMjY4fQ.bbESiiPENhti1jIvp_idT7pivrgcHLAVO4ToT6hHy90',
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
      url: 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/sign/map-data/iebc_offices_rows.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kN2NhMTc4OC1jOGY0LTQzNTYtODRiNy1lMzA0ODJiMjcyMzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXAtZGF0YS9pZWJjX29mZmljZXNfcm93cy5nZW9qc29uIiwiaWF0IjoxNzYwMTMyMzM5LCJleHAiOjI1NDg1MzIzMzl9.r55VxOz0AEuH80Q-9uaN8E9joAQHf3WVC6byzCjPloQ',
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
    }
  };

  // Fetch GeoJSON data for a layer
  const fetchLayerData = useCallback(async (layerId) => {
    if (layerData[layerId]) return; // Already loaded

    setLoading(true);
    try {
      const config = layerConfigs[layerId];
      const response = await fetch(config.url);
      const geojson = await response.json();
      
      setLayerData(prev => ({
        ...prev,
        [layerId]: geojson
      }));
    } catch (error) {
      console.error(`Error loading GeoJSON for ${layerId}:`, error);
    } finally {
      setLoading(false);
    }
  }, [layerData, layerConfigs]);

  // Load data for active layers
  useEffect(() => {
    activeLayers.forEach(layerId => {
      if (layerConfigs[layerId]) {
        fetchLayerData(layerId);
      }
    });
  }, [activeLayers, fetchLayerData]);

  // Enhanced popup content with Supabase data
  const onEachFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.id) {
      // Fetch detailed office data from Supabase when feature is clicked
      layer.on('click', async (e) => {
        try {
          const { data: office, error } = await supabase
            .from('iebc_offices')
            .select('*')
            .eq('id', feature.properties.id)
            .single();

          if (error) throw error;

          if (office && onOfficeSelect) {
            onOfficeSelect(office);
          }

          // Create enhanced popup content
          const popupContent = `
            <div class="min-w-[280px] p-3">
              <div class="flex items-start justify-between mb-2">
                <h3 class="font-semibold text-ios-gray-900 text-base">
                  ${office.constituency_name || 'IEBC Office'}
                </h3>
                ${office.verified ? `
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
                  <span>${office.office_location}</span>
                </div>
                
                <div class="flex items-center space-x-2 text-ios-gray-600">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>${office.county} County</span>
                </div>

                ${office.landmark ? `
                  <div class="flex items-center space-x-2 text-ios-gray-500 text-xs">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span>Near ${office.landmark}</span>
                  </div>
                ` : ''}
              </div>

              <div class="mt-4 flex space-x-2">
                <button 
                  onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${office.latitude},${office.longitude}&travelmode=driving', '_blank')"
                  class="flex-1 bg-ios-blue text-white py-2 px-4 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span>Navigate</span>
                </button>
                
                <button 
                  onclick="navigator.clipboard.writeText('${office.latitude},${office.longitude}')"
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

          layer.bindPopup(popupContent).openPopup();
        } catch (error) {
          console.error('Error fetching office details:', error);
          layer.bindPopup(`
            <div class="p-3">
              <h3 class="font-semibold text-ios-gray-900">${feature.properties.constituency_name || 'IEBC Office'}</h3>
              <p class="text-ios-gray-600 text-sm mt-1">Unable to load details</p>
            </div>
          `).openPopup();
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
        this.setStyle(layerConfigs[activeLayers.find(l => layerData[l]?.features?.includes(feature))]?.style || {});
      });
    }
  }, [onOfficeSelect, activeLayers, layerData]);

  if (loading) {
    return null; // Or return a loading indicator
  }

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
