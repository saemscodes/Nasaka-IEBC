// src/components/IEBCOffice/UberModal.jsx
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { formatFare } from '@/utils/kenyaFareCalculator';

const UberModal = ({ isOpen, onClose, onProductSelect, pickup, destination, fareEstimates }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  const uberProducts = [
    {
      id: 'chap_chap',
      name: 'Chap Chap',
      description: 'Motorcycle taxis - Fast & affordable',
      icon: '🏍️',
      productType: 'a5a0d0d4-8c0f-4c3c-9e89-0b2d8a2c7f2a'
    },
    {
      id: 'uberx',
      name: 'UberX',
      description: 'Everyday affordable rides',
      icon: '🚗',
      productType: 'a1111c8c-c720-46c3-8534-2fcdd730040d'
    },
    {
      id: 'comfort',
      name: 'Comfort',
      description: 'Newer cars with extra legroom',
      icon: '✨',
      productType: 'UberComfort'
    },
    {
      id: 'uberxl',
      name: 'UberXL',
      description: 'Larger vehicles for groups',
      icon: '🚙',
      productType: '821415d8-3bd5-4e27-9604-194e4359a449'
    }
  ];

  const handleProductSelect = (product) => {
    onProductSelect(product);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getFareForProduct = (productId) => {
    if (!fareEstimates || !fareEstimates.uber) return null;
    return fareEstimates.uber[productId];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="uber-modal-container">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="uber-modal-backdrop"
            onClick={handleBackdropClick}
          />
          
          {/* Modal Content */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl overflow-hidden ${
              isDark ? 'bg-gray-900' : 'bg-white'
            } shadow-2xl`}
          >
            <div className={`p-6 border-b ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  Choose Uber Ride
                </h3>
                <button
                  onClick={onClose}
                  className={`p-2 rounded-full ${
                    isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
                 }`}>
                Select your preferred ride type{' '}
                <span className={`text-gray-400 italic`}>
                  (No discount applied)
                </span>
              </p>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
              {uberProducts.map((product) => {
                const fare = getFareForProduct(product.id);
                return (
                  <motion.button
                    key={product.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleProductSelect(product)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                      isDark 
                        ? 'bg-gray-800 border-gray-700 hover:border-gray-600' 
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="text-2xl">{product.icon}</span>
                        <div>
                          <h4 className={`font-semibold ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {product.name}
                          </h4>
                          <p className={`text-sm ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {product.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {fare ? (
                          <>
                            <span className={`text-lg font-bold ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                              {formatFare(fare.total)}
                            </span>
                            <p className={`text-xs mt-1 ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              ~{fare.estimatedMinutes} min
                            </p>
                          </>
                        ) : (
                          <span className={`text-sm ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Price unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className={`p-4 border-t ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <button
                onClick={onClose}
                className={`w-full py-3 px-6 rounded-2xl font-medium ${
                  isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UberModal;
