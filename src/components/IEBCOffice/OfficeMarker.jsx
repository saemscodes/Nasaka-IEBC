import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';

const createOfficeIcon = (isSelected, isNearest) => {
  const backgroundColor = isSelected ? '#FF3B30' : (isNearest ? '#34C759' : '#007AFF');
  const borderColor = isSelected ? '#FFFFFF' : '#FFFFFF';
  const shadow = isSelected ? '0 0 0 4px rgba(255, 59, 48, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.15)';
  
  return L.divIcon({
    className: 'office-marker',
    html: `
      <div style="
        background: ${backgroundColor};
        border: 2px solid ${borderColor};
        border-radius: 50%;
        width: 20px;
        height: 20px;
        box-shadow: ${shadow};
        position: relative;
        ${isNearest ? 'animation: pulse 2s infinite;' : ''}
      ">
        ${isNearest ? `
          <div style="
            position: absolute;
            top: -6px;
            left: -6px;
            right: -6px;
            bottom: -6px;
            border: 2px solid ${backgroundColor};
            border-radius: 50%;
            animation: ring-pulse 2s infinite;
          "></div>
        ` : ''}
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes ring-pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      </style>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

const OfficeMarker = ({ office, isSelected, isNearest, onSelect }) => {
  if (!office?.latitude || !office?.longitude) return null;

  const position = [office.latitude, office.longitude];

  const handleClick = () => {
    onSelect(office);
  };

  return (
    <Marker
      position={position}
      icon={createOfficeIcon(isSelected, isNearest)}
      eventHandlers={{
        click: handleClick
      }}
      zIndexOffset={isSelected ? 1000 : (isNearest ? 500 : 0)}
    >
      <Popup>
        <div className="p-2 min-w-[200px]">
          <h3 className="font-semibold text-ios-gray-900 text-sm mb-1">
            {office.constituency_name}
          </h3>
          <p className="text-ios-gray-600 text-xs mb-2">
            {office.office_location}
          </p>
          <p className="text-ios-gray-500 text-xs">
            {office.county} County
          </p>
          {office.distance && (
            <p className="text-ios-blue text-xs font-medium mt-1">
              {typeof office.distance === 'number' 
                ? `${office.distance.toFixed(1)} km away`
                : office.distance
              }
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  );
};

export default OfficeMarker;
