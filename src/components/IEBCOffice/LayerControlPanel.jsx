import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const LayerControlPanel = ({
  layers = [],
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
      description: 'Live IEBC office locations with real-time updates',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'blue',
      enabledByDefault: true
    },
    {
      id: 'constituencies',
      name: 'Kenya Constituencies',
      description: 'Parliamentary and electoral boundaries with constituency codes',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      color: 'yellow',
      enabledByDefault: true
    },
    {
      id: 'kenya-counties',
      name: 'Kenya Counties',
      description: 'County boundaries with voter registration data',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      ),
      color: 'gray',
      enabledByDefault: true
    },
    {
      id: 'healthcare-facilities',
      name: 'Healthcare Facilities',
      description: 'Hospitals and clinics across the country',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      ),
      color: 'purple',
      enabledByDefault: false
    },
    {
      id: 'iebc-offices-static',
      name: 'IEBC Offices (Static)',
      description: 'Static IEBC office data from GeoJSON files',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      color: 'blue',
      enabledByDefault: false
    },
    {
      id: 'iebc-offices-rows',
      name: 'IEBC Offices (Detailed)',
      description: 'Detailed IEBC office information with additional metadata',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'green',
      enabledByDefault: false
    }
  ];

  const baseMapOptions = [
    {
      id: 'standard',
      name: 'Standard Map',
      description: 'OpenStreetMap standard view',
      preview: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3'
    },
    {
      id: 'satellite',
      name: 'Satellite View',
      description: 'High-resolution satellite imagery',
      preview: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  ];

  const getLayerColor = (color) => {
    const colors = {
      blue: 'bg-blue-500 border-blue-600',
      yellow: 'bg-yellow-400 border-yellow-500',
      gray: 'bg-gray-400 border-gray-500',
      purple: 'bg-purple-500 border-purple-600',
      green: 'bg-green-500 border-green-600'
    };
    return colors[color] || 'bg-gray-400 border-gray-500';
  };

  const handleLayerToggle = (layerId) => {
    onToggleLayer(layerId);
  };

  const handleBaseMapChange = (mapId) => {
    onBaseMapChange(mapId);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-xl z-[1000] flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-gray-200 z-10 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Map Settings</h2>
                <p className="text-sm text-gray-500 mt-1">Customize your map view</p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                aria-label="Close panel"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto h-full px-6 py-6">
            {/* Base Map Selection */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Base Map
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {baseMapOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleBaseMapChange(option.id)}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      baseMap === option.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-2 ${
                        baseMap === option.id ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <svg className={`w-6 h-6 ${
                          baseMap === option.id ? 'text-blue-600' : 'text-gray-500'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.preview} />
                        </svg>
                      </div>
                      <span className={`text-sm font-medium ${
                        baseMap === option.id ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {option.name}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
                        {option.description}
                      </span>
                    </div>
                    {baseMap === option.id && (
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Layers */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Data Layers
              </h3>
              <div className="space-y-3">
                {availableLayers.map((layer) => {
                  const isActive = layers.includes(layer.id);
                  const layerColor = getLayerColor(layer.color);

                  return (
                    <div
                      key={layer.id}
                      className={`w-full p-4 rounded-xl border-2 transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`w-4 h-4 rounded border-2 mt-1 flex-shrink-0 ${layerColor}`}></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                                isActive ? 'bg-blue-100' : 'bg-gray-100'
                              }`}>
                                <div className={`${
                                  isActive ? 'text-blue-600' : 'text-gray-500'
                                }`}>
                                  {layer.icon}
                                </div>
                              </div>
                              <div className="flex-1">
                                <h4 className={`text-base font-semibold ${
                                  'text-gray-900'
                                }`}>
                                  {layer.name}
                                </h4>
                                <p className={`text-sm mt-1 ${
                                  'text-gray-500'
                                }`}>
                                  {layer.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="relative inline-flex items-center flex-shrink-0 ml-4">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => handleLayerToggle(layer.id)}
                            className="sr-only"
                          />
                          <motion.div 
                            className={`relative inline-flex items-center w-12 h-6 rounded-full cursor-pointer transition-colors duration-300 ease-in-out ${
                              isActive
                                ? layerColor.split(' ')[0]
                                : 'bg-gray-300'
                            }`}
                            style={{
                              boxShadow: isActive
                                ? `0 0 0 2px rgba(59, 130, 246, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.1)` 
                                : 'inset 0 1px 2px rgba(0, 0, 0, 0.1)'
                            }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {/* Track background with subtle gradient */}
                            <div className={`absolute inset-0 rounded-full ${
                              isActive
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                                : 'bg-gradient-to-r from-gray-300 to-gray-400'
                            }`} />
                            
                            {/* Thumb with enhanced shadow and perfect centering */}
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
                            
                            {/* Inner glow effect for the thumb */}
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

                            {/* Active state ripple effect */}
                            {isActive && (
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

                            {/* Inactive state subtle inner shadow */}
                            {!isActive && (
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Layers Status */}
            <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Active Layers</h4>
                  <div className="space-y-2">
                    {layers.map((layerId) => {
                      const layer = availableLayers.find(l => l.id === layerId);
                      if (!layer) return null;
                      
                      return (
                        <div key={layerId} className="flex items-center space-x-2 text-sm">
                          <div className={`w-3 h-3 rounded ${getLayerColor(layer.color).split(' ')[0]}`}></div>
                          <span className="text-blue-800 font-medium">{layer.name}</span>
                        </div>
                      );
                    })}
                    {layers.length === 0 && (
                      <p className="text-blue-700 text-sm">No layers active. Toggle layers above to display data.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Information Section */}
            <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-yellow-900 mb-1">About Layers</h4>
                  <p className="text-xs text-yellow-800">
                    <strong>Constituencies layer</strong> shows parliamentary boundaries with constituency codes and electoral data. 
                    Toggle layers on and off to customize your map view. You can combine multiple data layers with different base maps for the best experience.
                  </p>
                  <p className="text-xs text-yellow-700 mt-2">
                    🗳️ Data provided by IEBC and Recall254 for civic education in Kenya.
                  </p>
                </div>
              </div>
            </div>

            {/* Spacer for mobile */}
            <div className="h-20" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LayerControlPanel;
