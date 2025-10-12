// src/components/IEBCOffice/MapContainer.jsx
import React, { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import { MapContainer as LeafletMap, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Double-tap detection component
const DoubleTapHandler = ({ onDoubleTap, doubleTapDelay = 300 }) => {
  const [lastTap, setLastTap] = useState(0);
  const map = useMap();

  useMapEvents({
    click: (e) => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      
      if (tapLength < doubleTapDelay && tapLength > 0) {
        // Double-tap detected
        onDoubleTap(e.latlng);
        setLastTap(0);
      } else {
        setLastTap(currentTime);
      }
    },
  });

  return null;
};

// Map controller component
const MapController = forwardRef(({ center, zoom, onMapReady, onDoubleTap }, ref) => {
  const map = useMap();

  useImperativeHandle(ref, () => ({
    flyTo: (latLng, zoomLevel, options) => {
      map.flyTo(latLng, zoomLevel, options);
    },
    setView: (latLng, zoomLevel) => {
      map.setView(latLng, zoomLevel);
    },
    getCenter: () => map.getCenter(),
    getZoom: () => map.getZoom(),
    getMap: () => map,
    getBounds: () => map.getBounds()
  }), [map]);

  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  useEffect(() => {
    if (map && onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  return (
    <>
      <DoubleTapHandler onDoubleTap={onDoubleTap} />
    </>
  );
});

MapController.displayName = 'MapController';

const MapContainer = forwardRef(({
  center,
  zoom,
  children,
  className,
  onMapReady,
  onDoubleTap,
  ...props
}, ref) => {
  const defaultCenter = [-1.286389, 36.817223]; // Nairobi
  const defaultZoom = 10;

  const handleDoubleTap = useCallback((latlng) => {
    if (onDoubleTap) {
      onDoubleTap(latlng);
    }
  }, [onDoubleTap]);

  return (
    <div className="map-wrapper">
      <LeafletMap
        center={center || defaultCenter}
        zoom={zoom || defaultZoom}
        className={`w-full h-full ${className || ''}`}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 'var(--z-map-base)'
        }}
        zoomControl={true}
        doubleClickZoom={false}
        {...props}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapController
          ref={ref}
          center={center}
          zoom={zoom}
          onMapReady={onMapReady}
          onDoubleTap={handleDoubleTap}
        />
        
        {children}
      </LeafletMap>
    </div>
  );
});

MapContainer.displayName = 'MapContainer';

export default MapContainer;
