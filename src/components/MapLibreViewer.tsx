
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, TrendingUp, Building2, Layers, Eye, EyeOff, Upload } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface County {
  id: number;
  name: string;
  total_count: number;
  registration_target: number;
  governor: string | null;
  senator: string | null;
}

interface Constituency {
  id: number;
  name: string;
  county_id: number;
  registration_target: number;
  member_of_parliament: string | null;
}

interface Ward {
  id: string;
  ward_name: string;
  constituency: string;
  county: string;
  registration_target: number;
}

interface MapLayer {
  id: string;
  name: string;
  type: 'counties' | 'constituencies' | 'wards';
  visible: boolean;
  data: any[];
  color: string;
}

const MapLibreViewer = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapStats, setMapStats] = useState({
    totalCounties: 0,
    totalConstituencies: 0,
    totalVoters: 0
  });
  
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Kenya center coordinates
  const kenyaCenter: [number, number] = [37.9062, -0.0236];

  useEffect(() => {
    initializeMap();
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapLoaded) {
      fetchMapData();
    }
  }, [mapLoaded]);

  useEffect(() => {
    if (mapLoaded && map.current) {
      updateMapLayers();
    }
  }, [layers, mapLoaded]);

  const initializeMap = () => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: kenyaCenter,
        zoom: 6,
        maxZoom: 18,
        minZoom: 2
      });

      // Add navigation control
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Add scale control
      map.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');

      map.current.on('load', () => {
        setMapLoaded(true);
        setIsLoading(false);
        console.log('MapLibre GL JS map loaded successfully');
      });

      map.current.on('error', (e) => {
        console.error('MapLibre error:', e);
        setIsLoading(false);
      });

    } catch (error) {
      console.error('Error initializing MapLibre map:', error);
      setIsLoading(false);
    }
  };

  const fetchMapData = async () => {
    try {
      // Fetch counties data
      const { data: counties, error: countiesError } = await supabase
        .from('counties')
        .select('*')
        .order('name');

      if (countiesError) throw countiesError;

      // Fetch constituencies data
      const { data: constituencies, error: constituenciesError } = await supabase
        .from('constituencies')
        .select('*')
        .order('name');

      if (constituenciesError) throw constituenciesError;

      // Fetch wards data
      const { data: wards, error: wardsError } = await supabase
        .from('wards')
        .select('*')
        .order('ward_name');

      if (wardsError) throw wardsError;

      const totalVoters = counties?.reduce((sum, county) => 
        sum + (county.total_count || 0), 0) || 0;

      setMapStats({
        totalCounties: counties?.length || 0,
        totalConstituencies: constituencies?.length || 0,
        totalVoters
      });

      // Initialize layers
      const initialLayers: MapLayer[] = [
        {
          id: 'counties',
          name: 'Counties',
          type: 'counties',
          visible: true,
          data: counties || [],
          color: '#059669'
        },
        {
          id: 'constituencies',
          name: 'Constituencies',
          type: 'constituencies',
          visible: false,
          data: constituencies || [],
          color: '#3B82F6'
        },
        {
          id: 'wards',
          name: 'Wards',
          type: 'wards',
          visible: false,
          data: wards || [],
          color: '#8B5CF6'
        }
      ];

      setLayers(initialLayers);
    } catch (error) {
      console.error('Error fetching map data:', error);
    }
  };

  const updateMapLayers = () => {
    if (!map.current || !mapLoaded) return;

    layers.forEach(layer => {
      const sourceId = `${layer.id}-source`;
      const layerId = `${layer.id}-layer`;

      // Remove existing layer and source
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
      if (map.current!.getSource(sourceId)) {
        map.current!.removeSource(sourceId);
      }

      if (layer.visible && layer.data.length > 0) {
        // Create GeoJSON features
        const features = layer.data.map((item, index) => {
          const coords = generateMockCoordinates(
            item.name || item.ward_name || 'Unknown', 
            index
          );
          
          return {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: coords
            },
            properties: {
              name: item.name || item.ward_name,
              type: layer.type,
              ...item
            }
          };
        });

        const geojson = {
          type: 'FeatureCollection' as const,
          features
        };

        // Add source
        map.current!.addSource(sourceId, {
          type: 'geojson',
          data: geojson
        });

        // Add layer
        map.current!.addLayer({
          id: layerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': 8,
            'circle-color': layer.color,
            'circle-opacity': 0.8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Add click event
        map.current!.on('click', layerId, (e) => {
          if (e.features && e.features[0]) {
            const feature = e.features[0];
            const properties = feature.properties;
            
            let popupContent = `<div class="p-3">
              <h4 class="font-bold text-lg mb-2">${properties.name || 'Unknown Location'}</h4>`;

            if (layer.type === 'counties') {
              popupContent += `
                <p><strong>Governor:</strong> ${properties.governor || 'N/A'}</p>
                <p><strong>Senator:</strong> ${properties.senator || 'N/A'}</p>
                <p><strong>Total Voters:</strong> ${(properties.total_count || 0).toLocaleString()}</p>
                <p><strong>Target:</strong> ${(properties.registration_target || 0).toLocaleString()}</p>
              `;
            } else if (layer.type === 'constituencies') {
              popupContent += `
                <p><strong>MP:</strong> ${properties.member_of_parliament || 'N/A'}</p>
                <p><strong>Target:</strong> ${(properties.registration_target || 0).toLocaleString()}</p>
              `;
            } else if (layer.type === 'wards') {
              popupContent += `
                <p><strong>Constituency:</strong> ${properties.constituency || 'N/A'}</p>
                <p><strong>County:</strong> ${properties.county || 'N/A'}</p>
                <p><strong>Target:</strong> ${(properties.registration_target || 0).toLocaleString()}</p>
              `;
            }

            popupContent += '</div>';

            new maplibregl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(popupContent)
              .addTo(map.current!);
          }
        });

        // Change cursor on hover
        map.current!.on('mouseenter', layerId, () => {
          map.current!.getCanvas().style.cursor = 'pointer';
        });

        map.current!.on('mouseleave', layerId, () => {
          map.current!.getCanvas().style.cursor = '';
        });
      }
    });
  };

  const generateMockCoordinates = (name: string, index: number): [number, number] => {
    const baseLatOffset = (index % 10) * 0.5 - 2.5;
    const baseLngOffset = (Math.floor(index / 10) % 10) * 0.8 - 4;
    return [
      kenyaCenter[0] + baseLngOffset + (Math.random() - 0.5) * 0.3,
      kenyaCenter[1] + baseLatOffset + (Math.random() - 0.5) * 0.3
    ];
  };

  const toggleLayerVisibility = (layerId: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, visible: !layer.visible }
        : layer
    ));
  };

  const renderMapContent = () => {
    if (isLoading) {
      return (
        <div className="w-full h-[500px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 dark:border-green-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Initializing MapLibre GL JS...</p>
          </div>
        </div>
      );
    }

    return (
      <div 
        ref={mapContainer}
        className="w-full h-[500px] rounded-lg overflow-hidden border border-green-200 dark:border-green-700"
        style={{ height: '500px' }}
      />
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-green-200 dark:border-green-700 bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/20 dark:to-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center text-green-900 dark:text-green-100">
            <MapPin className="w-5 h-5 mr-2" />
            Kenya Electoral Map - MapLibre GL JS
          </CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            High-performance vector map with customizable layers showing electoral data across Kenya
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {renderMapContent()}
            </div>

            <div className="space-y-4">
              {/* Layer Controls */}
              <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center">
                  <Layers className="w-4 h-4 mr-1" />
                  Map Layers
                </h4>
                <div className="space-y-2">
                  {layers.map(layer => (
                    <div key={layer.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full border-2 border-white"
                          style={{ backgroundColor: layer.color }}
                        ></div>
                        <span className="text-sm text-green-700 dark:text-green-300">
                          {layer.name} ({layer.data.length})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLayerVisibility(layer.id)}
                        className="h-6 w-6 p-0"
                      >
                        {layer.visible ? (
                          <Eye className="w-3 h-3 text-green-600" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* MapLibre Features */}
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  MapLibre Features
                </h4>
                <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                    <span>WebGL-accelerated rendering</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                    <span>Vector tiles for crisp graphics</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                    <span>Smooth 60fps interactions</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                    <span>3D capabilities ready</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Electoral Statistics
                </h4>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="text-center p-3 bg-white dark:bg-gray-700 rounded border border-green-100 dark:border-green-600">
                    <div className="font-bold text-green-800 dark:text-green-200">
                      {mapStats.totalCounties}
                    </div>
                    <div className="text-green-600 dark:text-green-400">Counties</div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-700 rounded border border-green-100 dark:border-green-600">
                    <div className="font-bold text-green-800 dark:text-green-200">
                      {mapStats.totalConstituencies}
                    </div>
                    <div className="text-green-600 dark:text-green-400">Constituencies</div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-700 rounded border border-green-100 dark:border-green-600">
                    <div className="font-bold text-green-800 dark:text-green-200">
                      {mapStats.totalVoters.toLocaleString()}
                    </div>
                    <div className="text-green-600 dark:text-green-400">Registered Voters</div>
                  </div>
                </div>
              </div>

              {/* Map Instructions */}
              <Card className="border-green-200 dark:border-green-700 bg-white dark:bg-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-green-900 dark:text-green-100">
                    How to Use
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-green-700 dark:text-green-300">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Toggle layers on/off using the eye icons</li>
                    <li>Click markers for detailed information</li>
                    <li>Use navigation controls to zoom and rotate</li>
                    <li>Smooth pan and zoom with WebGL acceleration</li>
                    <li>Different colors represent different data types</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapLibreViewer;
