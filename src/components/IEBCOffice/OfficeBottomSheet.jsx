// src/components/IEBCOffice/OfficeBottomSheet.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { calculateDistance } from '@/utils/geoUtils';

const OfficeBottomSheet = ({
  office,
  userLocation,
  currentRoute,
  routingError,
  state = 'peek',
  onExpand,
  onCollapse,
  onClose
}) => {
  const [dragY, setDragY] = useState(0);
  const dragControls = useDragControls();
  const sheetRef = useRef(null);

  // Calculate distance to office
  const distanceToOffice = React.useMemo(() => {
    if (!office || !userLocation?.latitude || !userLocation?.longitude) {
      return null;
    }
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      office.latitude,
      office.longitude
    );
  }, [office, userLocation]);

  // Handle drag end
  const handleDragEnd = (event, info) => {
    const threshold = 100;
    
    if (info.offset.y > threshold) {
      if (state === 'expanded') {
        onCollapse();
      } else {
        onClose();
      }
    } else if (info.offset.y < -threshold && state === 'peek') {
      onExpand();
    }
    
    setDragY(0);
  };

  // Open Google Maps for directions
  const openGoogleMaps = () => {
    if (!office) return;
    
    const destination = `${office.latitude},${office.longitude}`;
    const origin = userLocation 
      ? `${userLocation.latitude},${userLocation.longitude}`
      : '';
    
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}${origin ? `&origin=${origin}` : ''}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // Handle tap on peek area to expand
  const handlePeekTap = () => {
    if (state === 'peek') {
      onExpand();
    }
  };

  if (!office && state === 'hidden') {
    return null;
  }

  return (
    <AnimatePresence>
      {office && state !== 'hidden' && (
        <motion.div
          ref={sheetRef}
          drag="y"
          dragControls={dragControls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          initial={{ y: '100%' }}
          animate={{
            y: state === 'peek' ? 'calc(100% - 80px)' : 0
          }}
          exit={{ y: '100%' }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 40
          }}
          className={`office-bottom-sheet ${state}`}
          style={{ y: dragY }}
        >
          {/* Drag Handle */}
          <div
            className="bottom-sheet-handle"
            onPointerDown={(e) => dragControls.start(e)}
          />

          {/* Peek Preview - Always visible */}
          <div
            className="px-5 py-3 cursor-pointer"
            onClick={handlePeekTap}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
                  {office.office_name || office.constituency_name || 'IEBC Office'}
                </h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                  {office.constituency_name && office.county 
                    ? `${office.constituency_name}, ${office.county}`
                    : office.county || office.constituency_name || 'Location'}
                </p>
              </div>
              
              {distanceToOffice && (
                <div className="ml-4 text-right">
                  <span className="text-sm font-medium text-blue-600">
                    {distanceToOffice.toFixed(1)} km
                  </span>
                  {currentRoute && currentRoute[0] && (
                    <p className="text-xs text-gray-500 mt-1">
                      ~{Math.round(currentRoute[0].summary.totalTime / 60)} min
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Expanded Content - Only visible when expanded */}
          {state === 'expanded' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.1 }}
              className="bottom-sheet-content green-scrollbar"
            >
              {/* Office Details */}
              <div className="space-y-4">
                {/* Header */}
                <div className="border-b border-gray-200 pb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {office.office_name || office.constituency_name || 'IEBC Office'}
                  </h2>
                  {office.office_type && (
                    <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      {office.office_type}
                    </span>
                  )}
                </div>

                {/* Location Information */}
                <div className="space-y-3">
                  {office.constituency_name && (
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Constituency</p>
                        <p className="text-sm text-gray-600">{office.constituency_name}</p>
                      </div>
                    </div>
                  )}

                  {office.county && (
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">County</p>
                        <p className="text-sm text-gray-600">{office.county}</p>
                      </div>
                    </div>
                  )}

                  {office.address && (
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Address</p>
                        <p className="text-sm text-gray-600">{office.address}</p>
                      </div>
                    </div>
                  )}

                  {office.phone && (
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Phone</p>
                        <a href={`tel:${office.phone}`} className="text-sm text-blue-600 hover:underline">
                          {office.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {office.email && (
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Email</p>
                        <a href={`mailto:${office.email}`} className="text-sm text-blue-600 hover:underline">
                          {office.email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Distance & Route Info */}
                {distanceToOffice && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">Distance from you</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">
                          {distanceToOffice.toFixed(1)} km
                        </p>
                      </div>
                      {currentRoute && currentRoute[0] && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-blue-900">Estimated time</p>
                          <p className="text-2xl font-bold text-blue-600 mt-1">
                            {Math.round(currentRoute[0].summary.totalTime / 60)} min
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Routing Error */}
                {routingError && (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-amber-900">Route unavailable</p>
                        <p className="text-xs text-amber-700 mt-1">Use Google Maps for directions instead.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={openGoogleMaps}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 shadow-lg shadow-blue-600/30"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span>Get Directions (Google Maps)</span>
                  </button>

                  {office.latitude && office.longitude && (
                    <button
                      onClick={() => {
                        const coords = `${office.latitude},${office.longitude}`;
                        navigator.clipboard.writeText(coords);
                        alert('Coordinates copied to clipboard!');
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy Coordinates</span>
                    </button>
                  )}
                </div>

                {/* Additional Information */}
                {office.operating_hours && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Operating Hours</h4>
                    <p className="text-sm text-gray-700">{office.operating_hours}</p>
                  </div>
                )}

                {office.services && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Services Offered</h4>
                    <p className="text-sm text-gray-700">{office.services}</p>
                  </div>
                )}

                {office.notes && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Additional Notes</h4>
                    <p className="text-sm text-gray-700">{office.notes}</p>
                  </div>
                )}
              </div>

              {/* Close Button at Bottom */}
              <div className="sticky bottom-0 bg-white pt-4 pb-2 mt-6 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-2xl transition-all active:scale-95"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfficeBottomSheet;
