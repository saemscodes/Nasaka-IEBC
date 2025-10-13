import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ContributeLocationModal from './ContributeLocationModal';

const ContributeLocationButton = ({ userLocation, onSuccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ 
          scale: 1.05,
          backgroundColor: 'hsl(var(--accent))'
        }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsModalOpen(true)}
        className="ios-control-btn bg-ios-green text-ios-surface dark:bg-ios-green dark:text-ios-gray-900 hover:bg-ios-green/90 dark:hover:bg-ios-green/90 transition-all duration-200 shadow-ios-medium hover:shadow-ios-high"
        aria-label="Add new location data"
        title="Contribute location information"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Plus icon for adding contributions"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 5v14m-7-7h14"
          />
        </svg>
      </motion.button>

      <ContributeLocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(result) => {
          console.log('Contribution submitted successfully:', result);
          if (onSuccess) {
            onSuccess(result);
          }
        }}
        userLocation={userLocation}
      />
    </>
  );
};

export default ContributeLocationButton;
