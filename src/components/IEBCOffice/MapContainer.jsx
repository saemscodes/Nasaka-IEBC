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
const MapController = forwardRef(({ center, zoom, onMapReady, onDoubleTap, isModalMap }, ref) => {
  const map = useMap();
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useImperativeHandle(ref, () => ({
    flyTo: (latLng, zoomLevel, options) => {
      if (!map || !isMapLoaded) {
        console.warn('Map not ready for flyTo');
        return;
      }
      map.flyTo(latLng, zoomLevel, options);
    },
    setView: (latLng, zoomLevel) => {
      if (!map || !isMapLoaded) {
        console.warn('Map not ready for setView');
        return;
      }
      map.setView(latLng, zoomLevel);
    },
    getCenter: () => map.getCenter(),
    getZoom: () => map.getZoom(),
    getMap: () => map,
    getBounds: () => map.getBounds()
  }), [map, isMapLoaded]);

  useEffect(() => {
    if (center && map && isMapLoaded) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map, isMapLoaded]);

  useEffect(() => {
    const handleMapLoad = () => {
      setIsMapLoaded(true);
      if (onMapReady) {
        onMapReady(map);
      }
    };

    if (map) {
      map.whenReady(handleMapLoad);
    }

    return () => {
      setIsMapLoaded(false);
    };
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
  isModalMap = false,
  onClick,
  ...props 
}, ref) => {
  const defaultCenter = [-1.286389, 36.817223]; // Nairobi
  const defaultZoom = isModalMap ? 16 : 10;

  const handleDoubleTap = useCallback((latlng) => {
    if (onDoubleTap) {
      onDoubleTap(latlng);
    }
  }, [onDoubleTap]);

  const handleMapClick = useCallback((e) => {
    if (onClick) {
      onClick(e);
    }
  }, [onClick]);

  return (
    <div className="map-wrapper">
      <LeafletMap
        center={center || defaultCenter}
        zoom={zoom || defaultZoom}
        className={`w-full h-full ${className || ''}`}
        style={{ 
          position: 'relative', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          zIndex: isModalMap ? 'var(--z-map-modal, 1000)' : 'var(--z-map-base, 1)'
        }}
        zoomControl={true}
        doubleClickZoom={false}
        eventHandlers={{
          click: handleMapClick
        }}
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
          isModalMap={isModalMap}
        />
        {children}
      </LeafletMap>
    </div>
  );
});

MapContainer.displayName = 'MapContainer';

export default MapContainer;
