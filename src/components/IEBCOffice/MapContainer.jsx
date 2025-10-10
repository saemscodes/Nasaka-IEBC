import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { MapContainer as LeafletMap, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Map controller component for imperative handle
const MapController = forwardRef(({ center, zoom }, ref) => {
  const map = useMap();

  useImperativeHandle(ref, () => ({
    flyTo: (latLng, zoomLevel, options) => {
      map.flyTo(latLng, zoomLevel, options);
    },
    setView: (latLng, zoomLevel) => {
      map.setView(latLng, zoomLevel);
    },
    getCenter: () => map.getCenter(),
    getZoom: () => map.getZoom()
  }), [map]);

  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  return null;
});

const MapContainer = forwardRef(({ center, zoom, children, className, ...props }, ref) => {
  const defaultCenter = [-1.286389, 36.817223]; // Nairobi center
  const defaultZoom = 10;

  return (
    <LeafletMap
      center={center || defaultCenter}
      zoom={zoom || defaultZoom}
      className={className}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      {...props}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapController ref={ref} center={center} zoom={zoom} />
      {children}
    </LeafletMap>
  );
});

MapContainer.displayName = 'MapContainer';

export default MapContainer;
