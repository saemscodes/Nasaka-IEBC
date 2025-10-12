// src/components/IEBCOffice/OfficeListPanel.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { calculateDistance } from '@/utils/geoUtils';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';

const OfficeListPanel = ({
  offices,
  onSelectOffice,
  onClose,
  searchQuery,
  userLocation,
  isSearching = false
}) => {
  // Sort offices by distance if user location is available
  const sortedOffices = useMemo(() => {
    if (!userLocation?.latitude || !userLocation?.longitude) {
      return offices;
    }

    return [...offices].sort((a, b) => {
      const distanceA = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        a.latitude,
        a.longitude
      );
      const distanceB = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        b.latitude,
        b.longitude
      );
      return distanceA - distanceB;
    });
  }, [offices, userLocation]);

  // Calculate distance for each office
  const officesWithDistance = useMemo(() => {
    if (!userLocation?.latitude || !userLocation?.longitude) {
      return sortedOffices.map(office => ({ ...office, distance: null }));
    }

    return sortedOffices.map(office => ({
      ...office,
      distance: calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        office.latitude,
        office.longitude
      )
    }));
  }, [sortedOffices, userLocation]);

  return (
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="office-list-panel open"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-gray-200 z-10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {searchQuery ? 'Search Results' : 'Nearby Offices'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {isSearching ? (
                <span className="flex items-center">
                  <LoadingSpinner size="small" />
                  <span className="ml-2">Searching...</span>
                </span>
              ) : (
                `${officesWithDistance.length} office${officesWithDistance.length !== 1 ? 's' : ''} found`
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Office List */}
      <div className="overflow-y-auto h-full green-scrollbar">
        {officesWithDistance.length === 0 && !isSearching && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No offices found</h3>
            <p className="text-sm text-gray-600 text-center">
              {searchQuery 
                ? `No offices match "${searchQuery}". Try a different search.`
                : 'No IEBC offices found in your area.'}
            </p>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {officesWithDistance.map((office, index) => (
            <motion.button
              key={office.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelectOffice(office)}
              className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors active:bg-gray-100"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  {/* Office Name */}
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {office.county || office.constituency_name || 'IEBC Office'}
                  </h3>

                  {/* Location Info */}
                  <div className="flex items-center mt-1 space-x-1 text-sm text-gray-600">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">
                      {office.constituency_name && office.county
                        ? `${office.constituency_name}, ${office.county}`
                        : office.county_name || office.constituency_name || 'Location not available'}
                    </span>
                  </div>

                  {/* Office Type Badge */}
                  {office.office_type && (
                    <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      {office.office_type}
                    </span>
                  )}

                  {/* Address (if available) */}
                  {office.address && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-1">
                      {office.address}
                    </p>
                  )}
                </div>

                {/* Distance Badge */}
                <div className="flex-shrink-0 text-right">
                  {office.distance !== null && (
                    <div className="flex flex-col items-end">
                      <span className="text-base font-semibold text-blue-600">
                        {office.distance.toFixed(1)} km
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
                        {office.distance < 1 
                          ? 'Very close'
                          : office.distance < 5
                          ? 'Nearby'
                          : office.distance < 20
                          ? 'Drive away'
                          : 'Far'}
                      </span>
                    </div>
                  )}
                  
                  {/* Chevron */}
                  <svg className="w-5 h-5 text-gray-400 mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Bottom Padding for safe area */}
        <div className="h-20" />
      </div>
    </motion.div>
  );
};

export default OfficeListPanel;
