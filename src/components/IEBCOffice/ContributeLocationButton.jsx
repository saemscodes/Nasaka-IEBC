// src/components/IEBCOffice/ContributeLocationButton.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ContributeLocationModal from './ContributeLocationModal';

const ContributeLocationButton = ({ userLocation, onSuccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSuccess = (result) => {
    console.log('Contribution submitted successfully:', result);
    if (onSuccess) {
      onSuccess(result);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsModalOpen(true)}
        className="ios-control-btn bg-white border border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-all duration-200 shadow-lg"
        aria-label="Contribute location data"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
        </svg>
        <span className="ml-2 text-sm font-medium">Contribute Location</span>
      </motion.button>

      <ContributeLocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        userLocation={userLocation}
      />
    </>
  );
};

export default ContributeLocationButton;
