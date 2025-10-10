import React from 'react';
import { motion } from 'framer-motion';
import { canOpenInMaps } from '../../utils/navigationUtils';

const NavigateButton = ({ onClick, disabled = false }) => {
  const canNavigate = canOpenInMaps();

  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full py-4 px-6 rounded-2xl font-semibold text-base
        flex items-center justify-center space-x-3
        transition-all duration-200
        ${disabled
          ? 'bg-ios-gray-300 text-ios-gray-500 cursor-not-allowed'
          : 'bg-ios-blue text-white shadow-lg shadow-ios-blue/25 hover:shadow-ios-blue/40 active:shadow-ios-blue/20'
        }
      `}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      <span>
        {disabled 
          ? 'Location Unavailable' 
          : canNavigate 
            ? 'Start Navigation' 
            : 'Open in Maps'
        }
      </span>
    </motion.button>
  );
};

export default NavigateButton;
