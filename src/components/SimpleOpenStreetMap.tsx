
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

interface SimpleOpenStreetMapProps {
  className?: string;
  center?: [number, number];
  zoom?: number;
  height?: string;
}

const SimpleOpenStreetMap: React.FC<SimpleOpenStreetMapProps> = ({
  className = '',
  center = [-0.0236, 37.9062], // Kenya center
  zoom = 6,
  height = '500px'
}) => {
  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center}>
          <Popup>
            Kenya - Interactive OpenStreetMap
            <br />
            Fully functional map view
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

export default SimpleOpenStreetMap;
