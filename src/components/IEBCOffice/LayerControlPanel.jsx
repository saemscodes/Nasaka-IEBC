import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Layer data URLs
const LAYER_URLS = {
  'counties': 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/FULL%20CORRECTED%20-%20Kenya%20Counties%20Voters\'%20Data.geojson',
  'constituencies': 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/constituencies.geojson',
  'iebc-offices': 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/iebc-offices.geojson'
};

// Custom user location icon
const createUserLocationIcon = () => {
  return L.divIcon({
    className: 'custom-user-marker',
    html: `
      <div style="position: relative;">
        <div style="
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: rgba(59, 130, 246, 0.2);
          border: 2px solid rgba(59, 130, 246, 0.4);
          border-radius: 50%;
          animation: pulse 2s infinite;
        "></div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      </style>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

// Layer Cache Manager
class LayerCache {
  constructor() {
    this.cache = {};
    this.loading = {};
  }

  async get(layerId) {
    if (this.cache[layerId]) {
      return this.cache[layerId];
    }

    if (this.loading[layerId]) {
      return this.loading[layerId];
    }

    this.loading[layerId] = this.fetch(layerId);
    const data = await this.loading[layerId];
    delete this.loading[layerId];
    
    return data;
  }

  async fetch(layerId) {
    try {
      const url = LAYER_URLS[layerId];
      if (!url) return null;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${layerId}`);
      
      const data = await response.json();
      this.cache[layerId] = data;
      return data;
    } catch (error) {
      console.error(`Error loading layer ${layerId}:`, error);
      return null;
    }
  }

  has(layerId) {
    return !!this.cache[layerId];
  }

  clear(layerId) {
    if (layerId) {
      delete this.cache[layerId];
    } else {
      this.cache = {};
    }
  }
}

const layerCache = new LayerCache();

// Dynamic Layer Loader Component
const DynamicLayerLoader = ({ layerId, isVisible, onLoad, onError }) => {
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const map = useMap();

  useEffect(() => {
    let isMounted = true;

    const loadLayerData = async () => {
      if (!isVisible) {
        setGeoJsonData(null);
        return;
      }

      setIsLoading(true);
      
      try {
        const data = await layerCache.get(layerId);
        
        if (isMounted && data) {
          setGeoJsonData(data);
          onLoad?.(layerId);
        }
      } catch (error) {
        console.error(`Failed to load ${layerId}:`, error);
        onError?.(layerId, error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadLayerData();

    return () => {
      isMounted = false;
    };
  }, [layerId, isVisible, onLoad, onError]);

  if (!isVisible || !geoJsonData) return null;

  const getLayerStyle = (feature) => {
    switch (layerId) {
      case 'counties':
        return {
          fillColor: '#22c55e',
          fillOpacity: 0.15,
          color: '#16a34a',
          weight: 2,
          opacity: 0.8
        };
      case 'constituencies':
        return {
          fillColor: '#8b5cf6',
          fillOpacity: 0.1,
          color: '#7c3aed',
          weight: 1.5,
          opacity: 0.7
        };
      default:
        return {
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
          color: '#2563eb',
          weight: 2,
          opacity: 0.8
        };
    }
  };

  const onEachFeature = (feature, layer) => {
    if (feature.properties) {
      const props = feature.properties;
      let popupContent = '<div style="padding: 8px;">';
      
      if (layerId === 'counties') {
        popupContent += `<h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${props.NAME || props.COUNTY || 'Unknown County'}</h3>`;
        if (props.POPULATION) popupContent += `<p style="margin: 4px 0;"><strong>Population:</strong> ${props.POPULATION.toLocaleString()}</p>`;
        if (props.REGISTERED_VOTERS) popupContent += `<p style="margin: 4px 0;"><strong>Registered Voters:</strong> ${props.REGISTERED_VOTERS.toLocaleString()}</p>`;
      } else if (layerId === 'constituencies') {
        popupContent += `<h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${props.CONSTITUEN || props.NAME || 'Unknown Constituency'}</h3>`;
        if (props.COUNTY) popupContent += `<p style="margin: 4px 0;"><strong>County:</strong> ${props.COUNTY}</p>`;
      }
      
      popupContent += '</div>';
      layer.bindPopup(popupContent);
    }

    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          fillOpacity: 0.4,
          weight: 3
        });
      },
      mouseout: (e) => {
        const layer = e.target;
        layer.setStyle(getLayerStyle(feature));
      }
    });
  };

  return (
    <GeoJSON
      key={`${layerId}-${Date.now()}`}
      data={geoJsonData}
      style={getLayerStyle}
      onEachFeature={onEachFeature}
    />
  );
};

// User Location Marker Component
const UserLocationMarker = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 13, {
        duration: 1.5
      });
    }
  }, [position, map]);

  if (!position) return null;

  return (
    <Marker position={position} icon={createUserLocationIcon()}>
      <Popup>
        <div style={{ padding: '8px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Your Location</h3>
          <p style={{ margin: '4px 0', fontSize: '14px' }}>
            Lat: {position[0].toFixed(6)}<br />
            Lng: {position[1].toFixed(6)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
};

// Base Map Controller
const BaseMapController = ({ baseMap }) => {
  const map = useMap();

  const tileLayerUrl = useMemo(() => {
    switch (baseMap) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'standard':
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  }, [baseMap]);

  const attribution = useMemo(() => {
    switch (baseMap) {
      case 'satellite':
        return '&copy; <a href="https://www.esri.com/">Esri</a>';
      case 'standard':
      default:
        return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    }
  }, [baseMap]);

  return <TileLayer url={tileLayerUrl} attribution={attribution} />;
};

// Main Map Component
const IEBCMap = ({ 
  activeLayers = ['iebc-offices'], 
  userLocation = null,
  baseMap = 'standard',
  onLayerLoad,
  onLayerError
}) => {
  const [loadingLayers, setLoadingLayers] = useState(new Set());

  const handleLayerLoad = (layerId) => {
    setLoadingLayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(layerId);
      return newSet;
    });
    onLayerLoad?.(layerId);
  };

  const handleLayerError = (layerId, error) => {
    setLoadingLayers(prev => {
      const newSet = new Set(prev);
      newSet.delete(layerId);
      return newSet;
    });
    onLayerError?.(layerId, error);
  };

  useEffect(() => {
    const newLoading = new Set();
    activeLayers.forEach(layerId => {
      if (!layerCache.has(layerId)) {
        newLoading.add(layerId);
      }
    });
    setLoadingLayers(newLoading);
  }, [activeLayers]);

  const kenyaCenter = [-0.0236, 37.9062];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={kenyaCenter}
        zoom={6}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <BaseMapController baseMap={baseMap} />

        {activeLayers.map(layerId => (
          layerId !== 'user-location' && (
            <DynamicLayerLoader
              key={layerId}
              layerId={layerId}
              isVisible={activeLayers.includes(layerId)}
              onLoad={handleLayerLoad}
              onError={handleLayerError}
            />
          )
        ))}

        {activeLayers.includes('user-location') && userLocation && (
          <UserLocationMarker position={userLocation} />
        )}
      </MapContainer>

      {loadingLayers.size > 0 && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid #3b82f6',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
            Loading layers...
          </span>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default IEBCMap;
