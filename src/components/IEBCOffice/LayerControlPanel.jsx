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
      name: 'Kenya Constituencies',
      description: 'Distribution of constituency borders across the country',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6.5v11l6 2 6-2 6 2V6.5l-6-2-6 2-6-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5v14" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 4.5v14" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10l2 3 3-2 2 3" />
        </svg>
      ),
      color: 'blue'
    },
    {
      id: 'healthcare-facilities',
      name: 'Kenya Healthcare Facilities',
      description: 'Distribution of healthcare facilities across the country (large dataset — may take a few extra moments to load)',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      color: 'green'
    },
    {
      id: 'kenya-counties',
      name: 'Kenya Counties Voters Data',
      description: 'Distribution of county borders across the country',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      ),
      color: 'blue'
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

  const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY;

  const baseMapOptions = [
    {
      id: 'standard',
      name: 'Standard',
      description: 'OpenStreetMap Streets',
      image: `https://api.maptiler.com/maps/streets-v2/static/36.8219,-1.2921,12/400x300.png?key=${MAPTILER_KEY}`
    },
    {
      id: 'satellite',
      name: 'Satellite',
      description: 'Esri World Imagery',
      image: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1618/2405'
    },
    {
      id: 'dark',
      name: 'Black',
      description: 'Night Vision (OSM Dark)',
      image: `https://api.maptiler.com/maps/openstreetmap-dark/static/36.8219,-1.2921,12/400x300.png?key=${MAPTILER_KEY}`
    },
    {
      id: 'blue',
      name: 'Blue',
      description: 'Voyager Oceanic',
      image: `https://api.maptiler.com/maps/voyager/static/36.8219,-1.2921,12/400x300.png?key=${MAPTILER_KEY}`
    },
    {
      id: 'green',
      name: 'Green',
      description: 'Outdoor Terrain',
      image: `https://api.maptiler.com/maps/outdoor-v2/static/36.8219,-1.2921,12/400x300.png?key=${MAPTILER_KEY}`
    },
    {
      id: 'retro',
      name: 'Retro',
      description: 'TomTom Classic',
      image: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/12/2405/1618.png'
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
          <div className="grid grid-cols-2 gap-4">
            {baseMapOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleBaseMapChange(option.id)}
                className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${baseMap === option.id
                  ? 'border-primary ring-4 ring-primary/20'
                  : 'border-transparent bg-muted/30 hover:bg-muted/50'
                  }`}
              >
                <div className="aspect-[4/3] relative">
                  <img
                    src={option.image}
                    alt={option.name}
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${option.isRetro ? 'sepia-[0.6] brightness-[0.9] contrast-[1.1]' : ''
                      } ${baseMap === option.id ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  <div className="absolute bottom-3 left-3 right-3 text-left">
                    <span className="block text-sm font-bold text-white mb-0.5">
                      {option.name}
                    </span>
                    <span className="block text-[10px] text-gray-300 line-clamp-1 leading-tight">
                      {option.description}
                    </span>
                  </div>

                  {baseMap === option.id && (
                    <div className="absolute top-2 right-2">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white/20"
                      >
                        <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    </div>
                  )}
                </div>
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
              const isActive =
                layer.id === 'user-location'
                  ? !!userLocation || layers.includes(layer.id)
                  : layers.includes(layer.id);
              const isDisabled = layer.disabled;

              return (
                <button
                  key={layer.id}
                  onClick={() => handleLayerToggle(layer.id)}
                  disabled={isDisabled}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${isDisabled
                    ? 'border-muted bg-muted opacity-50 cursor-not-allowed'
                    : isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background hover:border-muted-foreground'
                    }`}
                >
                  <div className="flex items-start">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${isDisabled
                      ? 'bg-muted'
                      : isActive
                        ? 'bg-primary/20'
                        : 'bg-muted'
                      }`}>
                      <div className={`${isDisabled
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
                        <h4 className={`text-base font-semibold ${isDisabled ? 'text-muted-foreground' : 'text-foreground'
                          }`}>
                          {layer.name}
                        </h4>
                        <motion.div
                          className={`relative inline-flex items-center w-12 h-6 rounded-full cursor-pointer transition-colors duration-300 ease-in-out ${isDisabled
                            ? 'bg-muted/50'
                            : isActive
                              ? 'bg-primary'
                              : 'bg-muted'
                            }`}
                          style={{
                            boxShadow: isActive && !isDisabled
                              ? '0 0 0 2px rgba(var(--primary-rgb, 34, 197, 94), 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.1)'
                              : 'inset 0 1px 2px rgba(0, 0, 0, 0.1)'
                          }}
                          whileTap={!isDisabled ? { scale: 0.95 } : {}}
                        >
                          <div className={`absolute inset-0 rounded-full ${isActive && !isDisabled
                            ? 'bg-gradient-to-r from-primary to-primary/90'
                            : 'bg-gradient-to-r from-muted to-muted/80'
                            }`} />

                          <motion.span
                            className="absolute w-5 h-5 bg-white rounded-full z-10"
                            initial={false}
                            animate={{
                              x: isActive ? 26 : 2,
                              scale: isActive ? 1.05 : 1
                            }}
                            transition={{
                              type: 'spring',
                              stiffness: 600,
                              damping: 35,
                              mass: 0.7
                            }}
                            style={{
                              top: '2px',
                              boxShadow: `
                                0 2px 4px rgba(0, 0, 0, 0.2),
                                0 1px 2px rgba(0, 0, 0, 0.1),
                                inset 0 -1px 1px rgba(0, 0, 0, 0.05),
                                inset 0 1px 1px rgba(255, 255, 255, 0.8)
                              `,
                              filter: 'brightness(1.02)'
                            }}
                          />

                          <motion.span
                            className="absolute w-4 h-4 bg-white/20 rounded-full z-0"
                            initial={false}
                            animate={{
                              x: isActive ? 27 : 3,
                              scale: isActive ? 1 : 0.8
                            }}
                            transition={{
                              type: 'spring',
                              stiffness: 500,
                              damping: 40
                            }}
                            style={{
                              top: '3px'
                            }}
                          />

                          {isActive && !isDisabled && (
                            <motion.div
                              className="absolute inset-0 rounded-full z-0"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{
                                opacity: [0, 0.4, 0],
                                scale: [0.8, 1.3, 1]
                              }}
                              transition={{
                                duration: 0.5,
                                ease: 'easeOut',
                                times: [0, 0.3, 1]
                              }}
                              style={{
                                background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)',
                                filter: 'blur(0.5px)'
                              }}
                            />
                          )}

                          {!isActive && !isDisabled && (
                            <div
                              className="absolute inset-0 rounded-full"
                              style={{
                                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
                                background: 'linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.05) 100%)'
                              }}
                            />
                          )}
                        </motion.div>
                      </div>
                      <p className={`text-sm mt-1 ${isDisabled ? 'text-muted-foreground' : 'text-muted-foreground'
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
