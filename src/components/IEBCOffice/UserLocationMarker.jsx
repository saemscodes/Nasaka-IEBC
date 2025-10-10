import React from 'react';
import { Marker, Circle } from 'react-leaflet';
import L from 'leaflet';

const createUserLocationIcon = () => {
  return L.divIcon({
    className: 'user-location-marker',
    html: `
      <div class="relative">
        <div class="absolute inset-0 bg-ios-blue rounded-full animate-ping opacity-75"></div>
        <div class="relative w-6 h-6 bg-ios-blue rounded-full border-2 border-white shadow-lg"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const UserLocationMarker = ({ position, accuracy }) => {
  if (!position) return null;

  return (
    <>
      {/* Accuracy circle */}
      {accuracy && accuracy < 1000 && (
        <Circle
          center={position}
          radius={accuracy}
          pathOptions={{
            fillColor: '#007AFF',
            fillOpacity: 0.1,
            color: '#007AFF',
            opacity: 0.3,
            weight: 1
          }}
        />
      )}
      
      {/* User location marker */}
      <Marker
        position={position}
        icon={createUserLocationIcon()}
        zIndexOffset={1000}
      />
    </>
  );
};

export default UserLocationMarker;
