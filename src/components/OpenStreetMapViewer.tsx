
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  details?: any;
}

interface OpenStreetMapViewerProps {
  locations: Location[];
  center?: [number, number];
  zoom?: number;
  className?: string;
}

const OpenStreetMapViewer: React.FC<OpenStreetMapViewerProps> = ({
  locations = [],
  center = [-1.2864, 36.8172], // Default to Nairobi
  zoom = 7,
  className = "w-full h-96"
}) => {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    // Ensure Leaflet is properly initialized
    setMapReady(true);
  }, []);

  if (!mapReady) {
    return (
      <div className={`${className} bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full rounded-lg border border-green-200 dark:border-green-800"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {locations.map((location) => (
          <Marker
            key={location.id}
            position={[location.lat, location.lng]}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm mb-1">{location.name}</h3>
                <p className="text-xs text-gray-600 capitalize">{location.type}</p>
                {location.details && (
                  <div className="mt-2 text-xs">
                    {Object.entries(location.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key.replace('_', ' ')}:</span>
                        <span className="font-medium ml-2">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default OpenStreetMapViewer;
