import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Navigation, MapPin, Phone, Clock, 
  CheckCircle, XCircle, RefreshCw, Filter,
  ExternalLink, Users, Target, AlertTriangle
} from 'lucide-react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCachedOffices, setCachedOffices } from '@/utils/offlineStorage';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Environment-based URLs
const RECALL_GEOJSON_URL = import.meta.env.VITE_RECALL_GEOJSON_URL || 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/sign/map-data/FULL%20CORRECTED%20-%20Kenya%20Counties%20Voters%27%20Data.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kN2NhMTc4OC1jOGY0LTQzNTYtODRiNy1lMzA0ODJiMjcyMzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXAtZGF0YS9GVUxMIENPUlJFQ1RFRCAtIEtlbnlhIENvdW50aWVzIFZvdGVycycgRGF0YS5nZW9qc29uIiwiaWF0IjoxNzU5NDc0Njg5LCJleHAiOjE3NjcyNTA2ODl9.Ibva3F5rotSZuviun2b-psMKwqAP9l1-rjg7OPri2bM';
const IEBC_OFFICES_URL = import.meta.env.VITE_IEBC_OFFICES_GEOJSON_URL || 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/sign/map-data/iebc_offices.geojson';

export interface OfficeFeature {
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
    result_type?: string;
    importance_score?: number;
    geocoding_service?: string;
  };
}

export interface IEBCVoterRegistrationMapProps {
  className?: string;
  recallGeoJsonUrl?: string;
  officesGeoJsonUrl?: string;
  showVoterRegistrationInfo?: boolean;
}

const IEBCVoterRegistrationMap: React.FC<IEBCVoterRegistrationMapProps> = ({ 
  className,
  recallGeoJsonUrl = RECALL_GEOJSON_URL,
  officesGeoJsonUrl = IEBC_OFFICES_URL,
  showVoterRegistrationInfo = true
}) => {
  const [recallGeoJson, setRecallGeoJson] = useState<any>(null);
  const [officesGeoJson, setOfficesGeoJson] = useState<OfficeFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOffices, setFilteredOffices] = useState<OfficeFeature[]>([]);
  const [selectedCounty, setSelectedCounty] = useState<string>('');
  const [selectedConstituency, setSelectedConstituency] = useState<string>('');
  const [nearestOffice, setNearestOffice] = useState<OfficeFeature | null>(null);
  const [distanceToNearest, setDistanceToNearest] = useState<number | null>(null);
  const [activeLayer, setActiveLayer] = useState<'counties' | 'offices' | 'both'>('both');
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const officesLayerRef = useRef<L.GeoJSON | null>(null);
  const constituenciesLayerRef = useRef<L.GeoJSON | null>(null);
  const { toast } = useToast();

  // Memoized data calculations
  const counties = useMemo(() => 
    Array.from(new Set(officesGeoJson.map(f => f.properties.county))).sort(),
    [officesGeoJson]
  );

  const constituencies = useMemo(() =>
    Array.from(new Set(officesGeoJson.map(f => f.properties.constituency_name))).sort(),
    [officesGeoJson]
  );

  const verifiedOfficesCount = useMemo(() =>
    officesGeoJson.filter(o => o.properties.verified).length,
    [officesGeoJson]
  );

  const highConfidenceOfficesCount = useMemo(() =>
    officesGeoJson.filter(o => o.properties.geocode_confidence > 0.7).length,
    [officesGeoJson]
  );

  // Custom office icons with Nominatim-specific styling
  const createOfficeIcon = useCallback((verified: boolean, confidence: number) => {
    let color = '#f59e0b'; // Default orange for Nominatim
    
    if (verified) {
      color = '#10b981'; // Green for verified
    } else if (confidence > 0.8) {
      color = '#3b82f6'; // Blue for high confidence
    } else if (confidence > 0.6) {
      color = '#8b5cf6'; // Purple for medium confidence
    }
    
    return L.divIcon({
      className: 'custom-office-marker',
      html: `
        <div style="
          background-color: ${color};
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        " title="IEBC Office">
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }, []);

  // Load GeoJSON data with error handling and offline support
  const loadGeoJsonData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [recallResponse, officesResponse] = await Promise.all([
        fetch(recallGeoJsonUrl).catch(() => null),
        fetch(officesGeoJsonUrl).catch(() => null)
      ]);
      
      if (!recallResponse || !recallResponse.ok) {
        console.warn('Constituency data not available');
      }
      
      if (!officesResponse || !officesResponse.ok) {
        console.warn('IEBC offices data not available online, checking cache...');
        
        // Try to load from cache
        const cachedOffices = await getCachedOffices();
        if (cachedOffices) {
          console.log('Loaded offices from cache');
          setOfficesGeoJson(cachedOffices.data);
          setFilteredOffices(cachedOffices.data);
          
          toast({
            title: "Offline Mode",
            description: `Loaded ${cachedOffices.data.length} cached IEBC offices`,
            variant: "default",
          });
        } else {
          console.warn('No cached data available');
          toast({
            title: "Offline Mode",
            description: "No cached data available. Please connect to internet to load office data.",
            variant: "destructive",
          });
        }
        
        setLoading(false);
        return;
      }
      
      const recallData = recallResponse ? await recallResponse.json() : null;
      const officesData = officesResponse ? await officesResponse.json() : null;
      
      if (recallData) {
        setRecallGeoJson(recallData);
      }
      
      if (officesData) {
        const officesFeatures = officesData.features || [];
        setOfficesGeoJson(officesFeatures);
        setFilteredOffices(officesFeatures);
        
        // Cache the offices data for offline use
        try {
          await setCachedOffices(officesFeatures);
          console.log('Offices data cached for offline use');
        } catch (cacheError) {
          console.warn('Failed to cache offices data:', cacheError);
        }
        
        toast({
          title: "Data Loaded Successfully",
          description: `Loaded ${officesFeatures.length} IEBC offices${recallData ? ` and ${recallData.features?.length || 0} constituencies` : ''}`,
        });
      }
      
    } catch (error) {
      console.error('Error loading GeoJSON data:', error);
      
      // Try cache as fallback
      try {
        const cachedOffices = await getCachedOffices();
        if (cachedOffices) {
          setOfficesGeoJson(cachedOffices.data);
          setFilteredOffices(cachedOffices.data);
          
          toast({
            title: "Offline Mode",
            description: `Loaded ${cachedOffices.data.length} cached IEBC offices`,
            variant: "default",
          });
        }
      } catch (cacheError) {
        console.error('Cache loading failed:', cacheError);
        toast({
          title: "Data Loading Error",
          description: "Failed to load data online and no cache available",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [recallGeoJsonUrl, officesGeoJsonUrl, toast]);

  // Initialize map with proper layer management
  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current) return;

    // Initialize map centered on Kenya
    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true
    }).setView([-0.0236, 37.9062], 7);

    // Add OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      minZoom: 6
    }).addTo(mapRef.current);
  }, []);

  // Add constituency boundaries layer
  const addConstituenciesLayer = useCallback(() => {
    if (!mapRef.current || !recallGeoJson) return;

    // Remove existing layer
    if (constituenciesLayerRef.current) {
      mapRef.current.removeLayer(constituenciesLayerRef.current);
    }

    if (activeLayer === 'offices') return;

    constituenciesLayerRef.current = L.geoJSON(recallGeoJson, {
      style: {
        fillColor: '#3b82f6',
        weight: activeLayer === 'both' ? 1 : 2,
        opacity: activeLayer === 'both' ? 0.6 : 0.8,
        color: activeLayer === 'both' ? '#1d4ed8' : '#1e40af',
        fillOpacity: activeLayer === 'both' ? 0.05 : 0.1
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
          const popupContent = `
            <div class="p-3 min-w-[250px]">
              <h3 class="font-bold text-lg mb-2 text-blue-900">${feature.properties.name || 'Constituency'}</h3>
              <div class="space-y-1 text-sm">
                ${feature.properties.governor ? `<p><strong>Governor:</strong> ${feature.properties.governor}</p>` : ''}
                ${feature.properties.total_count ? `<p><strong>Registered Voters:</strong> ${feature.properties.total_count.toLocaleString()}</p>` : ''}
                ${feature.properties.registration_target ? `<p><strong>Registration Target:</strong> ${feature.properties.registration_target?.toLocaleString() || 'N/A'}</p>` : ''}
              </div>
            </div>
          `;
          layer.bindPopup(popupContent);
        }
      }
    }).addTo(mapRef.current);
  }, [recallGeoJson, activeLayer]);

  // Add IEBC offices layer
  const addOfficesLayer = useCallback(() => {
    if (!mapRef.current) return;

    // Remove existing layer
    if (officesLayerRef.current) {
      mapRef.current.removeLayer(officesLayerRef.current);
    }

    if (activeLayer === 'counties') return;

    officesLayerRef.current = L.geoJSON(filteredOffices, {
      pointToLayer: (feature, latlng) => {
        const props = feature.properties;
        return L.marker(latlng, {
          icon: createOfficeIcon(props.verified, props.geocode_confidence)
        });
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const confidenceColor = props.geocode_confidence > 0.8 ? 'text-green-600' : 
                              props.geocode_confidence > 0.6 ? 'text-yellow-600' : 'text-red-600';
        
        const popupContent = `
          <div class="p-3 min-w-[300px]">
            <div class="flex justify-between items-start mb-3">
              <h3 class="font-bold text-lg text-blue-900">${props.constituency_name}</h3>
              <div class="flex items-center space-x-1">
                ${props.verified ? 
                  '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">Verified</span>' : 
                  '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">Unverified</span>'
                }
                <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">${props.geocode_method || 'nominatim'}</span>
              </div>
            </div>
            
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-700 font-medium">County:</span>
                <span class="text-gray-900">${props.county}</span>
              </div>
              
              <div>
                <span class="text-gray-700 font-medium block mb-1">Office Location:</span>
                <p class="text-gray-900 bg-gray-50 p-2 rounded">${props.office_location}</p>
              </div>
              
              ${props.landmark ? `
                <div>
                  <span class="text-gray-700 font-medium block mb-1">Landmark:</span>
                  <p class="text-gray-900">${props.landmark}</p>
                </div>
              ` : ''}
              
              ${props.distance_from_landmark ? `
                <div class="flex justify-between">
                  <span class="text-gray-700 font-medium">Distance:</span>
                  <span class="text-gray-900">${props.distance_from_landmark}</span>
                </div>
              ` : ''}
              
              <div class="flex justify-between items-center pt-2 border-t border-gray-200">
                <span class="text-xs ${confidenceColor} font-medium">
                  Confidence: ${(props.geocode_confidence * 100).toFixed(0)}%
                </span>
                <button onclick="window.openDirections(${props.geometry.coordinates[0]}, ${props.geometry.coordinates[1]})" 
                  class="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 transition-colors font-medium">
                  Get Directions
                </button>
              </div>
            </div>
          </div>
        `;

        layer.bindPopup(popupContent);
        
        // Add click handler for better mobile experience
        layer.on('click', () => {
          layer.openPopup();
        });
      }
    }).addTo(mapRef.current);
  }, [filteredOffices, createOfficeIcon, activeLayer]);

  // Initialize map on component mount
  useEffect(() => {
    loadGeoJsonData();
  }, [loadGeoJsonData]);

  // Set up map and layers when data is loaded
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;

    if (!mapRef.current) {
      initializeMap();
    }

    addConstituenciesLayer();
    addOfficesLayer();

    // Fit bounds to show all offices when data changes
    if (filteredOffices.length > 0 && officesLayerRef.current) {
      mapRef.current?.fitBounds(officesLayerRef.current.getBounds(), { 
        padding: [20, 20],
        maxZoom: 12
      });
    }
  }, [loading, initializeMap, addConstituenciesLayer, addOfficesLayer, filteredOffices]);

  // Filter offices based on search criteria
  useEffect(() => {
    let filtered = officesGeoJson;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(office => 
        office.properties.constituency_name.toLowerCase().includes(query) ||
        office.properties.county.toLowerCase().includes(query) ||
        office.properties.office_location.toLowerCase().includes(query) ||
        office.properties.landmark.toLowerCase().includes(query)
      );
    }
    
    if (selectedCounty) {
      filtered = filtered.filter(office => 
        office.properties.county === selectedCounty
      );
    }

    if (selectedConstituency) {
      filtered = filtered.filter(office =>
        office.properties.constituency_name === selectedConstituency
      );
    }
    
    setFilteredOffices(filtered);
  }, [searchQuery, selectedCounty, selectedConstituency, officesGeoJson]);

  // Calculate distance using Haversine formula
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Find user's location and nearest office
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
      title: "Locating your position...",
      description: "Finding your current location and nearest IEBC office",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([longitude, latitude]);
        
        // Add user location marker
        if (mapRef.current) {
          const userMarker = L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: 'user-location-marker',
              html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })
          }).addTo(mapRef.current)
          .bindPopup('Your Current Location')
          .openPopup();

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
          setDistanceToNearest(minDistance);

          // Add line to nearest office
          if (nearest) {
            const [officeLng, officeLat] = nearest.geometry.coordinates;
            const polyline = L.polyline([
              [latitude, longitude],
              [officeLat, officeLng]
            ], {
              color: '#ef4444',
              weight: 3,
              opacity: 0.7,
              dashArray: '10, 10'
            }).addTo(mapRef.current!);
            
            polyline.bindPopup(`Distance to nearest IEBC office: ${minDistance.toFixed(1)} km`);
          }

          // Center map on user location
          mapRef.current.setView([latitude, longitude], 13);
          
          if (nearest && minDistance !== Infinity) {
            toast({
              title: "Location Found",
              description: `Nearest IEBC office: ${nearest.properties.constituency_name} (${minDistance.toFixed(1)} km away)`,
            });
          } else {
            toast({
              title: "Location Found",
              description: "Location found, but no IEBC offices nearby",
            });
          }
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = "Please enable location services to find nearby offices";
        
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access denied. Please enable location permissions in your browser settings.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Location request timed out. Please try again.";
        }
        
        toast({
          title: "Location access failed",
          description: errorMessage,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  }, [officesGeoJson, calculateDistance, toast, nearestOffice]);

  // Expose function to window for popup buttons
  useEffect(() => {
    (window as any).openDirections = (lng: number, lat: number) => {
      const url = `https://www.openstreetmap.org/directions?engine=osrm_car&route=0&to=${lat},${lng}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    };
  }, []);

  // Refresh data
  const refreshData = async () => {
    setLoading(true);
    try {
      await loadGeoJsonData();
      toast({
        title: "Data Refreshed",
        description: "IEBC office data has been updated",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Could not update office data",
        variant: "destructive",
      });
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCounty('');
    setSelectedConstituency('');
  };

  // Voter registration information component
  const VoterRegistrationInfo = () => (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center">
        <Users className="w-4 h-4 mr-2" />
        Voter Registration Information
      </h3>
      <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
        <p><strong>Eligibility:</strong> Kenyan citizen, 18+ years, original ID/passport required</p>
        <p><strong>Process:</strong> Visit office, fill Form A, receive acknowledgement slip</p>
        <p><strong>Note:</strong> Multiple registration is illegal with penalties up to KSh 100,000</p>
      </div>
    </div>
  );

  return (
    <div className={className}>
      <Card className="w-full border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white border-b-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center text-white text-2xl">
                <MapPin className="w-6 h-6 mr-3" />
                IEBC Voter Registration Offices
              </CardTitle>
              <CardDescription className="text-blue-100 text-lg mt-2">
                Find your nearest voter registration office across Kenya's 47 counties
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Button
                onClick={findUserLocation}
                size="sm"
                className="bg-white text-blue-700 hover:bg-blue-50 border-0 font-semibold"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Use My Location
              </Button>
              <Button
                onClick={refreshData}
                size="sm"
                variant="outline"
                disabled={loading}
                className="bg-white/20 text-white hover:bg-white/30 border-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 bg-gray-50/50">
          {/* Voter Registration Information */}
          {showVoterRegistrationInfo && <VoterRegistrationInfo />}

          {/* Controls Section */}
          <div className="p-4 bg-white border-b">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search constituency, county, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-blue-500"
                />
              </div>

              {/* County Filter */}
              <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                <SelectTrigger className="border-gray-300 focus:border-blue-500">
                  <SelectValue placeholder="Filter by County" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counties</SelectItem>
                  {counties.map(county => (
                    <SelectItem key={county} value={county}>{county}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Constituency Filter */}
              <Select value={selectedConstituency} onValueChange={setSelectedConstituency}>
                <SelectTrigger className="border-gray-300 focus:border-blue-500">
                  <SelectValue placeholder="Filter by Constituency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Constituencies</SelectItem>
                  {constituencies.map(constituency => (
                    <SelectItem key={constituency} value={constituency}>{constituency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Layer Controls */}
              <div className="flex space-x-2">
                <Button
                  variant={activeLayer === 'both' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveLayer('both')}
                  className="flex-1"
                >
                  Both Layers
                </Button>
                <Button
                  variant={activeLayer === 'offices' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveLayer('offices')}
                  className="flex-1"
                >
                  Offices Only
                </Button>
                <Button
                  variant={activeLayer === 'counties' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveLayer('counties')}
                  className="flex-1"
                >
                  Boundaries Only
                </Button>
              </div>
            </div>

            {/* Stats and Actions Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3">
                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {verifiedOfficesCount} Verified
                </Badge>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Target className="w-3 h-3 mr-1" />
                  {highConfidenceOfficesCount} High Confidence
                </Badge>
                <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                  <MapPin className="w-3 h-3 mr-1" />
                  {officesGeoJson.length} Total Offices
                </Badge>
                {(searchQuery || selectedCounty || selectedConstituency) && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    {filteredOffices.length} Filtered
                  </Badge>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {(searchQuery || selectedCounty || selectedConstituency) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>

            {/* Nearest Office Info */}
            {nearestOffice && distanceToNearest && (
              <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900 flex items-center">
                      <Navigation className="w-4 h-4 mr-2" />
                      Nearest IEBC Office: {nearestOffice.properties.constituency_name}
                    </h4>
                    <p className="text-sm text-green-700 mt-1">
                      {nearestOffice.properties.office_location} • {nearestOffice.properties.county}
                    </p>
                    <p className="text-sm text-green-600 font-medium">
                      Approximately {distanceToNearest.toFixed(1)} km from your location
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const [lng, lat] = nearestOffice.geometry.coordinates;
                      (window as any).openDirections(lng, lat);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Get Directions
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 z-50 flex items-center justify-center rounded-b-lg">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
                  <p className="text-lg font-medium text-gray-700">Loading IEBC Voter Registration Data</p>
                  <p className="text-sm text-gray-500 mt-1">Loading constituency boundaries and office locations...</p>
                </div>
              </div>
            )}
            
            <div 
              ref={mapContainerRef} 
              className="w-full h-[70vh] min-h-[500px] rounded-b-lg"
            />
          </div>

          {/* Legend and Information */}
          <div className="p-4 bg-white border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Legend */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Map Legend
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm"></div>
                    <span>Verified Office</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                    <span>High Confidence</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-sm"></div>
                    <span>Medium Confidence</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-sm"></div>
                    <span>Low Confidence</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
                    <span>Your Location</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-blue-500 bg-blue-50"></div>
                    <span>Constituency Boundary</span>
                  </div>
                </div>
              </div>

              {/* Data Information */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Data Information
                </h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Source:</strong> IEBC Constituency Offices PDF & OpenStreetMap Nominatim</p>
                  <p><strong>Geocoding:</strong> OpenStreetMap Nominatim API</p>
                  <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
                  <p><strong>Coverage:</strong> All 290 Constituencies across 47 Counties</p>
                  <p className="text-xs text-gray-500 mt-2">
                    This service helps Kenyan citizens find voter registration offices. 
                    Always verify office locations with official IEBC sources.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IEBCVoterRegistrationMap;
