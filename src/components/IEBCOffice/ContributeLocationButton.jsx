// src/components/IEBCOffice/ContributeLocationButton.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ContributeLocationModal from './ContributeLocationModal';

const ContributeLocationButton = ({ userLocation, onSuccess, variant = "default", showLabel = false, className = "" }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSuccess = (result) => {
    console.log('Contribution submitted successfully:', result);
    if (onSuccess) {
      onSuccess(result);
    }
    setIsModalOpen(false);
  };

  // Base button classes
  const baseClasses = "ios-control-btn bg-white border border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-all duration-200 shadow-lg";
  
  // Variant-specific classes
  const variantClasses = {
    default: "px-4 py-3 rounded-xl",
    compact: "p-3 rounded-full",
    floating: "p-4 rounded-full shadow-2xl",
    outlined: "px-4 py-2 border-2 bg-transparent hover:bg-green-500"
  };

  // Combined classes
  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${className}`;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ 
          scale: variant === "floating" ? 1.1 : 1.05,
          shadow: variant === "floating" ? "0 20px 40px rgba(0,0,0,0.3)" : "0 8px 20px rgba(0,0,0,0.2)"
        }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsModalOpen(true)}
        className={buttonClasses}
        aria-label="Contribute location data"
      >
        <div className="flex items-center justify-center">
          <svg
            className="w-6 h-6"
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
          {showLabel && (
            <span className="ml-2 text-sm font-medium">Contribute Location</span>
          )}
        </div>
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
