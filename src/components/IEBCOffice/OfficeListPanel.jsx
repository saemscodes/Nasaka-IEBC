import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistance, estimateTravelTime } from '../../utils/geoUtils';
import LoadingSpinner from './LoadingSpinner';

const OfficeListPanel = ({ 
  offices, 
  onSelectOffice, 
  onClose, 
  searchQuery,
  userLocation 
}) => {
  const panelVariants = {
    hidden: { x: '100%' },
    visible: { 
      x: 0,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
      }
    },
    exit: { 
      x: '100%',
      transition: { 
        duration: 0.2 
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3
      }
    })
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 z-[1200]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-xl"
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="glass-morphism border-b border-ios-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-ios-gray-900">
              {searchQuery ? 'Search Results' : 'Nearby Offices'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-ios-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6 text-ios-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center space-x-2 text-ios-gray-600 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span>
              {userLocation 
                ? 'Sorted by distance from you' 
                : 'Showing all IEBC offices'
              }
            </span>
          </div>
        </div>

        {/* Office List */}
        <div className="h-full overflow-y-auto pb-20">
          <AnimatePresence>
            {offices.length === 0 ? (
              <motion.div
                className="flex flex-col items-center justify-center py-16 px-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="w-16 h-16 bg-ios-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-ios-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-ios-gray-900 mb-2">
                  No offices found
                </h3>
                <p className="text-ios-gray-600 text-sm">
                  {searchQuery 
                    ? `No IEBC offices found for "${searchQuery}"`
                    : 'No IEBC offices available in your area'
                  }
                </p>
              </motion.div>
            ) : (
              <div className="p-4 space-y-3">
                {offices.map((office, index) => (
                  <motion.div
                    key={office.id}
                    custom={index}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="bg-white rounded-2xl p-4 border border-ios-gray-100 hover:border-ios-gray-300 transition-colors cursor-pointer elevation-low"
                    onClick={() => onSelectOffice(office)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-ios-gray-900 text-base pr-2">
                        {office.constituency_name}
                      </h3>
                      {office.verified && (
                        <span className="bg-ios-green/20 text-ios-green text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap shrink-0">
                          Verified
                        </span>
                      )}
                    </div>
                    
                    <p className="text-ios-gray-600 text-sm mb-3 line-clamp-2">
                      {office.office_location}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-xs">
                        <span className="text-ios-gray-500">{office.county}</span>
                        {office.distance && (
                          <div className="flex items-center space-x-1">
                            <svg className="w-3 h-3 text-ios-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="text-ios-gray-900 font-medium">
                              {formatDistance(office.distance)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {office.distance && (
                        <div className="text-ios-gray-500 text-xs">
                          {estimateTravelTime(office.distance).drivingFormatted}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OfficeListPanel;
