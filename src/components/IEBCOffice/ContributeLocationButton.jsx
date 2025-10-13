// src/components/IEBCOffice/ContributeLocationButton.js
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserLocation } from '@/hooks/useUserLocation';
import ContributeLocationModal from './ContributeLocationModal';
import LoadingSpinner from './LoadingSpinner';

const ContributeLocationButton = ({ className = '', onContributionSuccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { userLocation, isLoading: locationLoading, error: locationError } = useUserLocation();

  const handleOpenModal = useCallback(() => {
    console.log('Opening contribution modal...');
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    console.log('Closing contribution modal');
    setIsModalOpen(false);
  }, []);

  const handleContributionSuccess = useCallback((contributionData) => {
    console.log('Contribution successful:', contributionData);
    setIsModalOpen(false);
    
    if (onContributionSuccess) {
      onContributionSuccess(contributionData);
    }

    // Show success notification
    if (window.showSuccessNotification) {
      window.showSuccessNotification(
        'Contribution Submitted!', 
        'Your IEBC office location has been submitted for moderation.'
      );
    }
  }, [onContributionSuccess]);

  const handleTooltipToggle = useCallback((show) => {
    setShowTooltip(show);
  }, []);

  return (
    <>
      <div className={`relative ${className}`}>
        <motion.button
          onClick={handleOpenModal}
          onMouseEnter={() => handleTooltipToggle(true)}
          onMouseLeave={() => handleTooltipToggle(false)}
          onFocus={() => handleTooltipToggle(true)}
          onBlur={() => handleTooltipToggle(false)}
          disabled={locationLoading}
          className={`
            inline-flex items-center space-x-2 px-4 py-3 
            bg-gradient-to-r from-green-600 to-green-700 
            text-white font-medium rounded-xl 
            shadow-lg hover:shadow-xl 
            transform hover:scale-105 
            transition-all duration-200 
            focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50
            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
            ${locationLoading ? 'cursor-wait' : 'cursor-pointer'}
          `}
          whileHover={{ scale: locationLoading ? 1 : 1.05 }}
          whileTap={{ scale: locationLoading ? 1 : 0.95 }}
        >
          {locationLoading ? (
            <>
              <LoadingSpinner size="small" className="text-white" />
              <span>Getting Location...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Contribute Location</span>
            </>
          )}
        </motion.button>

        {/* Tooltip */}
        <AnimatePresence>
          {showTooltip && !locationLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl z-10"
            >
              <div className="text-center">
                <p className="font-medium mb-1">Help Improve IEBC Office Data</p>
                <p className="text-gray-300 text-xs">
                  Contribute accurate location data for IEBC offices across Kenya to help citizens find polling stations.
                </p>
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Location Error Badge */}
        {locationError && !locationLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full shadow-lg"
          >
            Location Needed
          </motion.div>
        )}
      </div>

      {/* Contribution Modal */}
      <ContributeLocationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleContributionSuccess}
        userLocation={userLocation}
      />
    </>
  );
};

export default ContributeLocationButton;
