import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Navigation, MapPin, Phone, Clock, 
  CheckCircle, XCircle, RefreshCw, Filter,
  ExternalLink
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface OfficeFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    constituency_code: string;
    constituency_name: string;
    county: string;
    office_location: string;
    landmark: string;
    distance_from_landmark: string;
    source: string;
    geocode_method: string;
    geocode_confidence: number;
    formatted_address: string;
    verified: boolean;
    notes: string;
  };
}

interface IEBCVoterRegistrationMapProps {
  className?: string;
  recallGeoJsonUrl: string;
  officesGeoJsonUrl: string;
}

const IEBCVoterRegistrationMap: React.FC<IEBCVoterRegistrationMapProps> = ({ 
  className, 
  recallGeoJsonUrl, 
  officesGeoJsonUrl 
}) => {
  const [recallGeoJson, setRecallGeoJson] = useState<any>(null);
  const [officesGeoJson, setOfficesGeoJson] = useState<OfficeFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOffices, setFilteredOffices] = useState<OfficeFeature[]>([]);
  const [selectedCounty, setSelectedCounty] = useState<string>('');
  const [nearestOffice, setNearestOffice] = useState<OfficeFeature | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Unique counties for filter
  const counties = Array.from(new Set(officesGeoJson.map(f => f.properties.county))).sort();

  // Custom office icons
  const createOfficeIcon = (verified: boolean, method: string) => {
    const color = verified ? '#10b981' : 
                 method === 'google' ? '#3b82f6' :
                 method === 'mapbox' ? '#8b5cf6' : '#f59e0b';
    
    return L.divIcon({
      className: 'custom-office-marker',
      html: `
        <div style="
          background-color: ${color};
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        "></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  // Load GeoJSON data
  useEffect(() => {
    const loadGeoJsonData = async () => {
      try {
        setLoading(true);
        
        const [recallResponse, officesResponse] = await Promise.all([
          fetch(recallGeoJsonUrl),
          fetch(officesGeoJsonUrl)
        ]);
        
        if (!recallResponse.ok || !officesResponse.ok) {
          throw new Error('Failed to load GeoJSON data');
        }
        
        const recallData = await recallResponse.json();
        const officesData = await officesResponse.json();
        
        setRecallGeoJson(recallData);
        setOfficesGeoJson(officesData.features || []);
        setFilteredOffices(officesData.features || []);
        
        toast({
          title: "Data Loaded",
          description: `Loaded ${officesData.features?.length || 0} IEBC offices`,
        });
        
      } catch (error) {
        console.error('Error loading GeoJSON data:', error);
        toast({
          title: "Loading Error",
          description: "Failed to load map data",
          variant: "destructive",
          action: (
            <ToastAction altText="Retry" onClick={loadGeoJsonData}>
              Retry
            </ToastAction>
          ),
        });
      } finally {
        setLoading(false);
      }
    };

    loadGeoJsonData();
  }, [recallGeoJsonUrl, officesGeoJsonUrl, toast]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || loading) return;

    // Initialize map centered on Kenya
    mapRef.current = L.map(mapContainerRef.current).setView([-0.0236, 37.9062], 7);

    // Add OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapRef.current);

    // Add Recall254 constituency polygons
    if (recallGeoJson) {
      L.geoJSON(recallGeoJson, {
        style: {
          fillColor: '#3b82f6',
          weight: 2,
          opacity: 0.8,
          color: '#1d4ed8',
          fillOpacity: 0.1
        },
        onEachFeature: (feature, layer) => {
          if (feature.properties) {
            const popupContent = `
              <div class="p-2 min-w-[200px]">
                <h3 class="font-bold text-lg mb-2">${feature.properties.name || 'Constituency'}</h3>
                ${feature.properties.governor ? `<p><strong>Governor:</strong> ${feature.properties.governor}</p>` : ''}
                ${feature.properties.total_count ? `<p><strong>Registered Voters:</strong> ${feature.properties.total_count.toLocaleString()}</p>` : ''}
              </div>
            `;
            layer.bindPopup(popupContent);
          }
        }
      }).addTo(mapRef.current);
    }

    // Add IEBC office markers
    filteredOffices.forEach((office) => {
      const [lng, lat] = office.geometry.coordinates;
      const props = office.properties;
      
      const marker = L.marker([lat, lng], {
        icon: createOfficeIcon(props.verified, props.geocode_method)
      }).addTo(mapRef.current!);

      const confidenceColor = props.geocode_confidence > 0.8 ? 'text-green-600' : 
                            props.geocode_confidence > 0.6 ? 'text-yellow-600' : 'text-red-600';
      
      const popupContent = `
        <div class="p-3 min-w-[280px]">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-bold text-lg text-blue-900">${props.constituency_name}</h3>
            <div class="flex items-center space-x-1">
              ${props.verified ? 
                '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Verified</span>' : 
                '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">Unverified</span>'
              }
              <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">${props.geocode_method}</span>
            </div>
          </div>
          
          <div class="space-y-2 text-sm">
            <div>
              <strong class="text-gray-700">County:</strong> 
              <span class="ml-1">${props.county}</span>
            </div>
            
            <div>
              <strong class="text-gray-700">Office Location:</strong>
              <p class="mt-1 text-gray-900">${props.office_location}</p>
            </div>
            
            ${props.landmark ? `
              <div>
                <strong class="text-gray-700">Landmark:</strong>
                <p class="mt-1 text-gray-900">${props.landmark}</p>
              </div>
            ` : ''}
            
            ${props.distance_from_landmark ? `
              <div>
                <strong class="text-gray-700">Distance:</strong>
                <span class="ml-1 text-gray-900">${props.distance_from_landmark}</span>
              </div>
            ` : ''}
            
            <div class="flex justify-between items-center pt-2 border-t">
              <span class="text-xs ${confidenceColor}">
                Confidence: ${(props.geocode_confidence * 100).toFixed(0)}%
              </span>
              <button onclick="window.findNearestOfficeFromHere(${lng}, ${lat})" 
                class="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 transition-colors">
                Get Directions
              </button>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
    });

    // Add user location marker if available
    if (userLocation) {
      L.marker([userLocation[1], userLocation[0]], {
        icon: L.divIcon({
          className: 'user-location-marker',
          html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })
      })
      .addTo(mapRef.current)
      .bindPopup('Your Current Location')
      .openPopup();
    }

    // Add nearest office line if available
    if (nearestOffice && userLocation) {
      const [officeLng, officeLat] = nearestOffice.geometry.coordinates;
      const polyline = L.polyline([
        [userLocation[1], userLocation[0]],
        [officeLat, officeLng]
      ], {
        color: '#ef4444',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
      }).addTo(mapRef.current);
      
      polyline.bindPopup(`Distance to nearest IEBC office: ${calculateDistance(
        userLocation[1], userLocation[0], officeLat, officeLng
      ).toFixed(1)} km`);
    }

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [recallGeoJson, filteredOffices, userLocation, nearestOffice, loading]);

  // Filter offices based on search and county
  useEffect(() => {
    let filtered = officesGeoJson;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(office => 
        office.properties.constituency_name.toLowerCase().includes(query) ||
        office.properties.county.toLowerCase().includes(query) ||
        office.properties.office_location.toLowerCase().includes(query)
      );
    }
    
    if (selectedCounty) {
      filtered = filtered.filter(office => 
        office.properties.county === selectedCounty
      );
    }
    
    setFilteredOffices(filtered);
    
    // Update map view if filtered results change significantly
    if (mapRef.current && filtered.length > 0) {
      const group = new L.FeatureGroup();
      filtered.forEach(office => {
        const [lng, lat] = office.geometry.coordinates;
        group.addLayer(L.marker([lat, lng]));
      });
      
      mapRef.current.fitBounds(group.getBounds(), { padding: [20, 20] });
    }
  }, [searchQuery, selectedCounty, officesGeoJson]);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

  // Find user's location
  const findUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Locating...",
      description: "Getting your current location",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([longitude, latitude]);
        
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 13);
        }

        // Find nearest office
        let nearest: OfficeFeature | null = null;
        let minDistance = Infinity;
        
        officesGeoJson.forEach(office => {
          const [officeLng, officeLat] = office.geometry.coordinates;
          const distance = calculateDistance(latitude, longitude, officeLat, officeLng);
          
          if (distance < minDistance) {
            minDistance = distance;
            nearest = office;
          }
        });
        
        setNearestOffice(nearest);
        
        toast({
          title: "Location Found",
          description: `Nearest IEBC office: ${nearest?.properties.constituency_name} (${minDistance.toFixed(1)} km away)`,
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          title: "Location access denied",
          description: "Please enable location services to find nearby offices",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  }, [officesGeoJson, toast]);

  // Expose function to window for popup buttons
  useEffect(() => {
    (window as any).findNearestOfficeFromHere = (lng: number, lat: number) => {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(url, '_blank');
    };
  }, []);

  // Refresh data
  const refreshData = async () => {
    setLoading(true);
    try {
      const response = await fetch(officesGeoJsonUrl);
      const data = await response.json();
      setOfficesGeoJson(data.features || []);
      setFilteredOffices(data.features || []);
      
      toast({
        title: "Data Refreshed",
        description: `Loaded ${data.features?.length || 0} IEBC offices`,
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Could not update office data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <Card className="w-full">
        <CardHeader className="bg-blue-50 dark:bg-blue-900/30 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center text-blue-800 dark:text-blue-100">
                <MapPin className="w-5 h-5 mr-2" />
                IEBC Voter Registration Offices
              </CardTitle>
              <CardDescription className="text-blue-600 dark:text-blue-300">
                Find your nearest voter registration office - {filteredOffices.length} offices found
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={findUserLocation}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Navigation className="w-4 h-4 mr-1" />
                Use My Location
              </Button>
              <Button
                onClick={refreshData}
                size="sm"
                variant="outline"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Controls Section */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search constituency or county..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* County Filter */}
              <select
                value={selectedCounty}
                onChange={(e) => setSelectedCounty(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">All Counties</option>
                {counties.map(county => (
                  <option key={county} value={county}>{county}</option>
                ))}
              </select>

              {/* Stats Badges */}
              <div className="flex items-center space-x-2 justify-end">
                <Badge variant="outline" className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                  {officesGeoJson.filter(o => o.properties.verified).length} Verified
                </Badge>
                <Badge variant="outline">
                  Total: {officesGeoJson.length}
                </Badge>
              </div>
            </div>

            {/* Nearest Office Info */}
            {nearestOffice && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-green-900 dark:text-green-100">
                      Nearest Office: {nearestOffice.properties.constituency_name}
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {nearestOffice.properties.office_location} • {nearestOffice.properties.county}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const [lng, lat] = nearestOffice.geometry.coordinates;
                      (window as any).findNearestOfficeFromHere(lng, lat);
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Directions
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-10 flex items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-sm text-gray-600">Loading IEBC office data...</p>
                </div>
              </div>
            )}
            
            <div 
              ref={mapContainerRef} 
              className="w-full h-[600px] rounded-b-lg"
            />
          </div>

          {/* Legend */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium">Legend:</span>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>
                <span>Verified Office</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>
                <span>Google Geocoded</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-white"></div>
                <span>Mapbox Geocoded</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white"></div>
                <span>Nominatim Geocoded</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white"></div>
                <span>Your Location</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IEBCVoterRegistrationMap;
