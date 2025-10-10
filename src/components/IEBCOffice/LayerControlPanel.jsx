import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Settings, X } from 'lucide-react';

const LayerControlPanel = ({ 
  layers, 
  onToggleLayer, 
  isOpen, 
  onClose,
  userLocation 
}) => {
  const layerConfigs = {
    'iebc-offices': {
      name: 'IEBC Offices',
      description: 'Main IEBC registration offices',
      color: '#007AFF',
      enabled: layers.includes('iebc-offices')
    },
    'iebc-offices-rows': {
      name: 'IEBC Offices (Detailed)',
      description: 'Detailed office information with routes',
      color: '#34C759',
      enabled: layers.includes('iebc-offices-rows')
    }
  };

  const panelVariants = {
    closed: {
      x: '100%',
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: "easeInOut"
      }
    },
    open: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  const itemVariants = {
    closed: { opacity: 0, x: 20 },
    open: { opacity: 1, x: 0 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-[1100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-xl"
            variants={panelVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="glass-morphism border-b border-ios-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-ios-blue rounded-full flex items-center justify-center">
                    <Layers className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-ios-gray-900">
                      Map Layers
                    </h2>
                    <p className="text-ios-gray-500 text-sm">
                      Toggle map features
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-ios-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-ios-gray-500" />
                </button>
              </div>
            </div>

            {/* Layer Controls */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <motion.div
                className="bg-ios-gray-50 rounded-2xl p-4"
                variants={itemVariants}
              >
                <h3 className="font-semibold text-ios-gray-900 mb-3 text-sm">
                  Data Layers
                </h3>
                <div className="space-y-3">
                  {Object.entries(layerConfigs).map(([layerId, config]) => (
                    <motion.div
                      key={layerId}
                      className="flex items-center justify-between p-3 bg-white rounded-xl border border-ios-gray-200 hover:border-ios-gray-300 transition-colors"
                      variants={itemVariants}
                    >
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: config.color }}
                        />
                        <div>
                          <div className="font-medium text-ios-gray-900 text-sm">
                            {config.name}
                          </div>
                          <div className="text-ios-gray-500 text-xs">
                            {config.description}
                          </div>
                        </div>
                      </div>
                      
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={() => onToggleLayer(layerId)}
                          className="sr-only peer"
                        />
                        <div className={`
                          w-11 h-6 bg-ios-gray-200 peer-focus:outline-none rounded-full peer 
                          peer-checked:after:translate-x-full peer-checked:after:border-white 
                          after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                          after:bg-white after:border-ios-gray-300 after:border after:rounded-full 
                          after:h-5 after:w-5 after:transition-all
                          peer-checked:bg-ios-blue
                          ${config.enabled ? 'bg-ios-blue' : 'bg-ios-gray-200'}
                        `} />
                      </label>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* User Location Status */}
              {userLocation && (
                <motion.div
                  className="bg-ios-green/10 rounded-2xl p-4 border border-ios-green/20"
                  variants={itemVariants}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-ios-green rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-ios-gray-900 text-sm">
                        Location Active
                      </div>
                      <div className="text-ios-gray-500 text-xs">
                        GPS accuracy: {userLocation.accuracy ? `${Math.round(userLocation.accuracy)}m` : 'Good'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Routing Information */}
              <motion.div
                className="bg-ios-blue/10 rounded-2xl p-4 border border-ios-blue/20"
                variants={itemVariants}
              >
                <h3 className="font-semibold text-ios-gray-900 mb-2 text-sm">
                  Routing Features
                </h3>
                <ul className="text-ios-gray-600 text-sm space-y-1">
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-ios-blue rounded-full"></div>
                    <span>Click any office for details</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-ios-green rounded-full"></div>
                    <span>Auto-plot routes from your location</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-ios-red rounded-full"></div>
                    <span>Multiple route alternatives</span>
                  </li>
                </ul>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LayerControlPanel;
