import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ContributeLocationModal from './ContributeLocationModal';

const ContributeLocationButton = ({ userLocation }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsModalOpen(true)}
        className="ios-control-btn bg-green-500 hover:bg-green-600 text-white"
        aria-label="Contribute location data"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v14M5 12h14"
          />
        </svg>
      </motion.button>

      <ContributeLocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          console.log('Contribution submitted successfully');
        }}
        userLocation={userLocation}
      />
    </>
  );
};

export default ContributeLocationButton;
