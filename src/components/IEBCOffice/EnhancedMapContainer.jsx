import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { MapContainer as LeafletMap, TileLayer, useMap, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Map controller component
const MapController = forwardRef(({ center, zoom, onMapReady }, ref) => {
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
    getMap: () => map
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

  return null;
});

const EnhancedMapContainer = forwardRef(({ 
  center, 
  zoom, 
  children, 
  className, 
  onMapReady,
  showLayerControl = true,
  ...props 
}, ref) => {
  const defaultCenter = [-1.286389, 36.817223]; // Nairobi
  const defaultZoom = 10;

  return (
    <LeafletMap
      center={center || defaultCenter}
      zoom={zoom || defaultZoom}
      className={className}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
      {...props}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {/* Optional Satellite Layer */}
      {showLayerControl && (
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Standard">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            />
          </LayersControl.BaseLayer>
        </LayersControl>
      )}
      
      <MapController ref={ref} center={center} zoom={zoom} onMapReady={onMapReady} />
      {children}
    </LeafletMap>
  );
});

EnhancedMapContainer.displayName = 'EnhancedMapContainer';

export default EnhancedMapContainer;
