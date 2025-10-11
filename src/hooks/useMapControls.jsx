import React, { useState, useCallback, useRef } from 'react';

export const useMapControls = (initialCenter = [-1.286389, 36.817223]) => {
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [mapZoom, setMapZoom] = useState(10);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [isListPanelOpen, setIsListPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef(null);

  const flyToOffice = useCallback((office) => {
    if (office?.latitude && office?.longitude && mapRef.current) {
      const latLng = [office.latitude, office.longitude];
      setMapCenter(latLng);
      setMapZoom(15);
      setSelectedOffice(office);
      
      if (mapRef.current) {
        mapRef.current.flyTo(latLng, 15, {
          duration: 1.5
        });
      }
    }
  }, []);

  const flyToLocation = useCallback((lat, lng, zoom = 15) => {
    if (mapRef.current) {
      const latLng = [lat, lng];
      setMapCenter(latLng);
      setMapZoom(zoom);
      
      mapRef.current.flyTo(latLng, zoom, {
        duration: 1.5
      });
    }
  }, []);

  const resetMap = useCallback(() => {
    setSelectedOffice(null);
    setSearchQuery('');
    if (mapRef.current) {
      mapRef.current.flyTo(initialCenter, 10, {
        duration: 1
      });
    }
  }, [initialCenter]);

  const openListPanel = useCallback(() => {
    setIsListPanelOpen(true);
  }, []);

  const closeListPanel = useCallback(() => {
    setIsListPanelOpen(false);
  }, []);

  const toggleListPanel = useCallback(() => {
    setIsListPanelOpen(prev => !prev);
  }, []);

  return {
    mapCenter,
    mapZoom,
    selectedOffice,
    isListPanelOpen,
    searchQuery,
    mapRef,
    
    // Actions
    setMapCenter,
    setMapZoom,
    setSelectedOffice,
    setSearchQuery,
    flyToOffice,
    flyToLocation,
    resetMap,
    openListPanel,
    closeListPanel,
    toggleListPanel
  };
};
