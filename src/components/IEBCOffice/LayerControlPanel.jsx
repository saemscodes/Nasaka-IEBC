// src/components/IEBCOffice/LayerControlPanel.jsx
import React from 'react';
import { motion } from 'framer-motion';

const LayerControlPanel = ({
  layers,
  onToggleLayer,
  isOpen,
  onClose,
  userLocation,
  baseMap = 'standard',
  onBaseMapChange
}) => {
  const availableLayers = [
    {
      id: 'iebc-offices',
      name: 'IEBC Offices',
      description: 'All IEBC office locations across Kenya',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'primary'
    },
    {
      id: 'constituencies',
      name: 'Constituencies',
      description: 'Electoral constituency boundaries',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      color: 'green'
    },
    {
      id: 'counties',
      name: 'Counties',
      description: 'Kenya county boundaries',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      ),
      color: 'purple'
    },
    {
      id: 'user-location',
      name: 'My Location',
      description: 'Show your current location on the map',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'red',
      disabled: !userLocation
    }
  ];

  const baseMapOptions = [
    {
      id: 'standard',
      name: 'Standard',
      description: 'Default street map view',
      preview: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3'
    },
    {
      id: 'satellite',
      name: 'Satellite',
      description: 'Aerial imagery view',
      preview: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  ];

  const handleLayerToggle = (layerId) => {
    if (availableLayers.find(l => l.id === layerId)?.disabled) {
      return;
    }
    onToggleLayer(layerId);
  };

  const handleBaseMapChange = (mapId) => {
    onBaseMapChange(mapId);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="layer-control-panel open"
    >
      <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border z-10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Map Layers</h2>
            <p className="text-sm text-muted-foreground mt-1">Customize your map view</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-y-auto h-full green-scrollbar px-5 py-6">
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            Base Map
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {baseMapOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleBaseMapChange(option.id)}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  baseMap === option.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background hover:border-muted-foreground'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-2 ${
                    baseMap === option.id ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    <svg className={`w-6 h-6 ${
                      baseMap === option.id ? 'text-primary' : 'text-muted-foreground'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.preview} />
                    </svg>
                  </div>
                  <span className={`text-sm font-medium ${
                    baseMap === option.id ? 'text-primary' : 'text-foreground'
                  }`}>
                    {option.name}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </span>
                </div>
                {baseMap === option.id && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            Data Layers
          </h3>
          <div className="space-y-3">
            {availableLayers.map((layer) => {
              const isActive = layers.includes(layer.id);
              const isDisabled = layer.disabled;

              return (
                <button
                  key={layer.id}
                  onClick={() => handleLayerToggle(layer.id)}
                  disabled={isDisabled}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    isDisabled
                      ? 'border-muted bg-muted opacity-50 cursor-not-allowed'
                      : isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex items-start">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                      isDisabled
                        ? 'bg-muted'
                        : isActive
                        ? 'bg-primary/20'
                        : 'bg-muted'
                    }`}>
                      <div className={`${
                        isDisabled
                          ? 'text-muted-foreground'
                          : isActive
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      }`}>
                        {layer.icon}
                      </div>
                    </div>

                    <div className="ml-4 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-base font-semibold ${
                          isDisabled ? 'text-muted-foreground' : 'text-foreground'
                        }`}>
                          {layer.name}
                        </h4>
                        <div className={`relative inline-block w-12 h-6 transition-colors rounded-full ${
                          isDisabled
                            ? 'bg-muted'
                            : isActive
                            ? 'bg-primary'
                            : 'bg-muted'
                        }`}>
                          <span
                            className={`absolute left-1 top-1 w-4 h-4 bg-background rounded-full transition-transform ${
                              isActive ? 'transform translate-x-6' : ''
                            }`}
                          />
                        </div>
                      </div>
                      <p className={`text-sm mt-1 ${
                        isDisabled ? 'text-muted-foreground' : 'text-muted-foreground'
                      }`}>
                        {layer.description}
                      </p>
                      {isDisabled && layer.id === 'user-location' && (
                        <p className="text-xs text-destructive mt-2 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          Location permission required
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 p-4 bg-primary/10 rounded-xl border border-primary/20">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-semibold text-primary mb-1">About Layers</h4>
              <p className="text-xs text-primary">
                Toggle layers on and off to customize your map view. You can combine multiple data layers with different base maps for the best experience.
              </p>
            </div>
          </div>
        </div>

        <div className="h-20" />
      </div>
    </motion.div>
  );
};

export default LayerControlPanel;
