import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { estimateTravelTime, formatDistance } from '../../utils/geoUtils';
import { openNavigation } from '../../utils/navigationUtils';
import NavigateButton from './NavigateButton';

const OfficeBottomSheet = ({ office, userLocation, onOfficeSelect, currentRoute }) => {
  const [sheetState, setSheetState] = useState('expanded'); // 'collapsed' | 'expanded'

  if (!office) {
    return (
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-lg border-t border-ios-gray-200"
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="p-6 text-center">
          <div className="w-12 h-1 bg-ios-gray-300 rounded-full mx-auto mb-4" />
          <p className="text-ios-gray-600">Select an IEBC office to view details</p>
        </div>
      </motion.div>
    );
  }

  const travelTime = office.distance ? estimateTravelTime(office.distance) : null;

  const handleDragEnd = (event, info) => {
    if (info.offset.y > 50) {
      setSheetState('collapsed');
    } else if (info.offset.y < -50) {
      setSheetState('expanded');
    }
  };

  const handleNavigate = () => {
    if (office.latitude && office.longitude) {
      openNavigation(office.latitude, office.longitude);
    }
  };

  const toggleSheet = () => {
    setSheetState(prev => prev === 'expanded' ? 'collapsed' : 'expanded');
  };

  return (
    <motion.div
      className="pointer-events-auto absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-lg border-t border-ios-gray-200 max-h-[80vh] overflow-hidden"
      initial={{ y: 300 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
        <div className="w-12 h-1 bg-ios-gray-300 rounded-full" />
      </div>

      {/* Content */}
      <div className="px-6 pb-6 max-h-[70vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-xl font-semibold text-ios-gray-900 pr-4">
              {office.constituency_name}
            </h2>
            {office.verified && (
              <span className="bg-ios-green/20 text-ios-green text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap">
                Verified
              </span>
            )}
          </div>
          
          <p className="text-ios-gray-600 text-base mb-3">
            {office.office_location}
          </p>

          {office.distance && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4 text-ios-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <span className="text-ios-gray-900 font-medium text-sm">
                  {formatDistance(office.distance)}
                </span>
              </div>
              
              {travelTime && (
                <>
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4 text-ios-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-ios-gray-600 text-sm">
                      {travelTime.drivingFormatted}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Expanded content */}
        {sheetState === 'expanded' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* Office Details */}
            <div className="bg-ios-gray-50 rounded-2xl p-4">
              <h3 className="font-semibold text-ios-gray-900 mb-2 text-sm">Office Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ios-gray-600">County:</span>
                  <span className="text-ios-gray-900 font-medium">{office.county}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ios-gray-600">Constituency:</span>
                  <span className="text-ios-gray-900 font-medium">{office.constituency}</span>
                </div>
                {office.constituency_code && (
                  <div className="flex justify-between">
                    <span className="text-ios-gray-600">Code:</span>
                    <span className="text-ios-gray-900 font-medium">{office.constituency_code}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Location Details */}
            {(office.landmark || office.formatted_address) && (
              <div className="bg-ios-gray-50 rounded-2xl p-4">
                <h3 className="font-semibold text-ios-gray-900 mb-2 text-sm">Location</h3>
                <p className="text-ios-gray-600 text-sm">
                  {office.formatted_address || office.landmark}
                </p>
                {office.distance_from_landmark && (
                  <p className="text-ios-gray-500 text-xs mt-1">
                    {office.distance_from_landmark} from {office.landmark}
                  </p>
                )}
              </div>
            )}

            {/* Additional Information */}
            <div className="bg-ios-gray-50 rounded-2xl p-4">
              <h3 className="font-semibold text-ios-gray-900 mb-2 text-sm">Information</h3>
              <div className="space-y-2 text-sm">
                {office.geocode_confidence && (
                  <div className="flex justify-between">
                    <span className="text-ios-gray-600">Location Accuracy:</span>
                    <span className="text-ios-gray-900 font-medium">
                      {(office.geocode_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {office.source && (
                  <div className="flex justify-between">
                    <span className="text-ios-gray-600">Source:</span>
                    <span className="text-ios-gray-900 font-medium">{office.source}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {currentRoute && currentRoute.length > 0 && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="bg-ios-blue/10 rounded-2xl p-4 border border-ios-blue/20 mt-4"
        >
        <h3 className="font-semibold text-ios-gray-900 mb-2 text-sm">Route Information</h3>
        <div className="space-y-2">
          {currentRoute.slice(0, 3).map((route, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div 
                className={`w-3 h-3 rounded-full ${
                  index === 0 ? 'bg-ios-green' : 'bg-ios-gray-400'
                }`}
                />
              <span className={index === 0 ? 'font-medium text-ios-gray-900' : 'text-ios-gray-600'}>
                Route {index + 1}
              </span>
            </div>
            <div className="text-ios-gray-600">
              {(route.summary.totalDistance / 1000).toFixed(1)} km • {Math.round(route.summary.totalTime / 60)} min
            </div>
          </div>
        ))}
        </div>
      </motion.div>
    )}

        {/* Navigation Button */}
        <motion.div
          className={`mt-6 ${sheetState === 'collapsed' ? 'pt-4 border-t border-ios-gray-100' : ''}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <NavigateButton
            onClick={handleNavigate}
            disabled={!office.latitude || !office.longitude}
          />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default OfficeBottomSheet;
