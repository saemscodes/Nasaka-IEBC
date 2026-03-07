// src/components/IEBCOffice/UberModal.jsx
import React, { useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { formatFare } from '@/utils/kenyaFareCalculator';

// --- Direct SVG Embeddings for GO HAM Quality ---

const MotorcycleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 511.99 511.99" xmlns="http://www.w3.org/2000/svg">
    <g><path fill="currentColor" d="M95.998,242.668c-1.461,0-2.914-0.312-4.273-0.906l-42.671-18.657 c-3.883-1.703-6.391-5.531-6.391-9.781v-28.796c0-5.891,4.781-10.672,10.672-10.672s10.664,4.781,10.664,10.672l71.483,23.952 c5.625-1.75,11.609,1.375,13.367,7c1.75,5.625-1.383,11.609-7,13.359l-42.671,13.344C98.139,242.496,97.068,242.668,95.998,242.668 z" /></g>
    <path fill="currentColor" d="M148.481,317.446c-0.312,0-0.617,0-0.93-0.031c-5.875-0.516-10.218-5.672-9.71-11.545l5.765-66.796 c0.508-5.859,5.672-10.203,11.547-9.703c5.867,0.5,10.21,5.672,9.703,11.547l-5.765,66.78 C158.614,313.259,153.958,317.446,148.481,317.446z" />
    <g><path fill="currentColor" d="M85.334,261.323C38.28,261.323,0,299.604,0,346.665c0,47.047,38.28,85.326,85.334,85.326 c47.046,0,85.326-38.279,85.326-85.326C170.661,299.604,132.38,261.323,85.334,261.323z" />
      <path fill="currentColor" d="M426.647,261.323c-47.029,0-85.311,38.281-85.311,85.342c0,47.047,38.281,85.326,85.311,85.326 c47.062,0,85.343-38.279,85.343-85.326C511.99,299.604,473.71,261.323,426.647,261.323z" /></g>
    <path fill="currentColor" d="M85.342,357.321c-3.539,0-7-1.75-9.031-4.969c-3.141-4.984-1.656-11.562,3.328-14.719l101.326-63.998 c4.984-3.141,11.57-1.656,14.718,3.328c3.141,4.984,1.656,11.578-3.328,14.719L91.029,355.681 C89.256,356.79,87.287,357.321,85.342,357.321z" />
    <path fill="currentColor" d="M309.338,314.665H202.66c-3.352,0-6.516-1.594-8.531-4.266l-62.202-82.95L28.038,185.903 c-4.75-1.906-7.484-6.906-6.516-11.922s5.359-8.656,10.477-8.656h254.527l73.139-20.608c5.484-1.531,11.203,1.484,13.016,6.891 l7.031,21.015c0.859,2.594,0.688,5.438-0.469,7.922l-60.266,127.996C317.212,312.274,313.463,314.665,309.338,314.665z" />
    <path fill="currentColor" d="M426.647,357.337c-4.469,0-8.625-2.828-10.108-7.297l-82.89-248.713h-24.312 c-5.906,0-10.688-4.766-10.688-10.656s4.781-10.672,10.688-10.672h31.999c4.578,0,8.656,2.938,10.109,7.297l85.326,255.994 c1.875,5.578-1.156,11.625-6.75,13.484C428.913,357.149,427.772,357.337,426.647,357.337z" />
  </svg>
);

const CarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M466.963,233.298c-0.194-0.647-0.26-1.295-0.455-1.942c-5.633-22.539-19.234-43.007-38.406-59.652 c-19.82-17.294-45.727-30.507-75.197-37.761c-16.774-4.209-34.715-6.476-53.369-6.476c-18.652,0-36.594,2.268-53.369,6.476 c-38.018,9.392-70.08,28.628-90.871,53.757c-10.881,13.084-18.652,27.786-22.668,43.396h-3.238 c-4.34,0-151.428,11.464-126.559,119.822h68.59c-0.064-1.167-0.129-2.332-0.129-3.497c0-3.433,0.324-6.866,0.842-9.845 c4.793-27.073,28.238-46.763,55.766-46.763s50.973,19.69,55.701,46.568c0.584,3.173,0.906,6.606,0.906,10.04 c0,1.049-0.059,2.098-0.115,3.149c-0.012,0.032-0.004,0.078-0.014,0.11h0.008c-0.004,0.08-0.004,0.159-0.008,0.238h144.045 c-0.064-1.167-0.129-2.332-0.129-3.497c0-3.433,0.324-6.866,0.842-9.845c4.793-27.073,28.24-46.763,55.766-46.763 c27.527,0,50.972,19.69,55.701,46.503c0.584,3.238,0.906,6.672,0.906,10.105c0,1.045-0.058,2.09-0.115,3.137 c-0.01,0.035-0.002,0.087-0.014,0.122h0.01c-0.006,0.08-0.006,0.159-0.01,0.238h56.719c7.629,0,13.816-6.203,13.844-13.831 C512.213,263.339,513.328,250.078,466.963,233.298z" />
  </svg>
);

const LimousineIcon = ({ className }) => (
  <svg className={className} viewBox="0 -43.14 122.88 122.88" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M0,23.97c0.29-1.63,1.11-2.63,2.72-2.69c-0.14-1.7,0.18-3.13,0.92-4.31c0.35-0.55,0.79-1.04,1.33-1.47 c1.87-1.52,3.99-1.68,6.3-2.1c2.24-0.41,4.48-0.75,6.71-1.01c2.7-0.32,5.41-0.53,8.12-0.61c1.25-0.04,0.95,0.03,1.95-0.73 c4.87-3.76,10.17-6.85,15.72-9.52C45.7,0.55,48.18,0.08,51.09,0C56.91,0,80,0,85.82,0c3.85,0.02,7.13,0.9,9.88,2.56l10.58,8.14 c3.53,0.23,7.05,0.46,10.58,0.7c2.16-0.06,3.81,0.68,4.44,3.02v7.15c2.99,0.77,1.04,7.66-0.3,9.17c-1.18,1.33-2.26,1.18-3.84,1.18 h-9.43c1.81-13.63-12.08-16.54-17.8-9.12c-1.89,2.45-2.18,5.79-1.39,9.72H28.45c2.19-10.1-4.33-14.21-10.33-13.62 c-7.72,0.76-9.75,6.95-8.42,13.74H3.01C1.11,32.72,0.22,31.2,0,28.63V23.97L0,23.97z M19.14,21.27 c4.23,0,7.67,3.43,7.67,7.67c0,4.23-3.43,7.67-7.67,7.67c-4.23,0-7.67-3.43-7.67-7.67C11.47,24.7,14.9,21.27,19.14,21.27 L19.14,21.27z M97.9,21.27c4.23,0,7.67,3.43,7.67,7.67c0,4.23-3.43,7.67-7.67,7.67c-4.23,0-7.67-3.43-7.67-7.67 C90.24,24.7,93.67,21.27,97.9,21.27L97.9,21.27z" />
  </svg>
);

const VanIcon = ({ className }) => (
  <svg className={className} viewBox="0 -26.28 122.88 122.88" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M29.34,41.02c-12.27,0-18.31,10.91-15.43,22.31L5.5,63.33C1.89,61.72,0.39,58.4,0,54.17v-6.96 c0-5.68,0-11.36,0-17.52c0-4.74,3.02-7.11,9.1-7.11l4.35,0L22.2,4.35C23.41,1.45,25.61,0,28.72,0h16.93v0.1h69.13 c5.16,0.05,7.96,2.51,8.11,7.68v55.55h-6.98c4.2-10.86-3.59-22.27-15.12-22.27c-11.55,0-19.35,11.4-15.14,22.27H45.39 C47.53,52.59,41.3,41.02,29.34,41.02L29.34,41.02z M29.32,53.74 c2.21,0,4,1.79,4,4c0,2.21-1.79,4-4,4c-2.21,0-4-1.79-4-4C25.32,55.53,27.11,53.74,29.32,53.74L29.32,53.74z M100.67,53.74 c2.21,0,4,1.79,4,4c0,2.21-1.79,4-4,4c-2.21,0-4-1.79-4-4C96.67,55.53,98.46,53.74,100.67,53.74L100.67,53.74z" />
  </svg>
);

const HappyIcon = ({ className }) => (
  <svg className={className} viewBox="0 -43.14 122.88 122.88" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M0,23.97c0.29-1.63,1.11-2.63,2.72-2.69c-0.14-1.7,0.18-3.13,0.92-4.31c0.35-0.55,0.79-1.04,1.33-1.47 c1.87-1.52,3.99-1.68,6.3-2.1c2.24-0.41,4.48-0.75,6.71-1.01c2.7-0.32,5.41-0.53,8.12-0.61c1.25-0.04,0.95,0.03,1.95-0.73 c4.87-3.76,10.17-6.85,15.72-9.52C45.7,0.55,48.18,0.08,51.09,0C56.91,0,80,0,85.82,0c3.85,0.02,7.13,0.9,9.88,2.56l10.58,8.14 c3.53,0.23,7.05,0.46,10.58,0.7c2.16-0.06,3.81,0.68,4.44,3.02v7.15c2.99,0.77,1.04,7.66-0.3,9.17c-1.18,1.33-2.26,1.18-3.84,1.18 h-9.43c1.81-13.63-12.08-16.54-17.8-9.12c-1.89,2.45-2.18,5.79-1.39,9.72H28.45c2.19-10.1-4.33-14.21-10.33-13.62 c-7.72,0.76-9.75,6.95-8.42,13.74H3.01C1.11,32.72,0.22,31.2,0,28.63V23.97L0,23.97z M19.14,21.27 c4.23,0,7.67,3.43,7.67,7.67c0,4.23-3.43,7.67-7.67,7.67c-4.23,0-7.67-3.43-7.67-7.67C11.47,24.7,14.9,21.27,19.14,21.27 L19.14,21.27z M97.9,21.27c4.23,0,7.67,3.43,7.67,7.67c0,4.23-3.43,7.67-7.67,7.67c-4.23,0-7.67-3.43-7.67-7.67 C90.24,24.7,93.67,21.27,97.9,21.27L97.9,21.27z" />
  </svg>
);

const UberLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 926.906 321.777" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path fill="currentColor" d="M53.328,229.809c3.917,10.395,9.34,19.283,16.27,26.664c6.93,7.382,15.14,13.031,24.63,16.948 c9.491,3.917,19.81,5.875,30.958,5.875c10.847,0,21.015-2.034,30.506-6.102s17.776-9.792,24.856-17.173 c7.08-7.382,12.579-16.194,16.496-26.438c3.917-10.244,5.875-21.692,5.875-34.347V0h47.453v316.354h-47.001v-29.376 c-10.545,11.147-22.974,19.734-37.285,25.761c-14.312,6.025-29.752,9.038-46.323,9.038c-16.873,0-32.615-2.938-47.228-8.813 c-14.612-5.875-27.267-14.235-37.962-25.082S15.441,264.006,9.265,248.79C3.088,233.575,0,216.628,0,197.947V0h47.453v195.236 C47.453,207.891,49.411,219.414,53.328,229.809z" />
      <path fill="currentColor" d="M332.168,0v115.243c10.545-10.545,22.748-18.905,36.607-25.082s28.924-9.265,45.193-9.265 c16.873,0,32.689,3.163,47.453,9.49c14.763,6.327,27.567,14.914,38.414,25.761s19.434,23.651,25.761,38.414 c6.327,14.764,9.49,30.431,9.49,47.002c0,16.57-3.163,32.162-9.49,46.774c-6.327,14.613-14.914,27.343-25.761,38.188 c-10.847,10.847-23.651,19.434-38.414,25.761c-14.764,6.327-30.581,9.49-47.453,9.49c-16.27,0-31.409-3.088-45.419-9.265 c-14.01-6.176-26.288-14.537-36.833-25.082v28.924h-45.193V0H332.168z M337.365,232.746c4.067,9.642,9.717,18.078,16.948,25.309 c7.231,7.231,15.667,12.956,25.308,17.174c9.642,4.218,20.036,6.327,31.184,6.327c10.847,0,21.09-2.109,30.731-6.327 s18.001-9.942,25.083-17.174c7.08-7.23,12.729-15.667,16.947-25.309c4.218-9.641,6.327-20.035,6.327-31.183 c0-11.148-2.109-21.618-6.327-31.41s-9.867-18.303-16.947-25.534c-7.081-7.23-15.441-12.88-25.083-16.947 s-19.885-6.102-30.731-6.102c-10.846,0-21.09,2.034-30.731,6.102s-18.077,9.717-25.309,16.947 c-7.23,7.231-12.955,15.742-17.173,25.534c-4.218,9.792-6.327,20.262-6.327,31.41C331.264,212.711,333.298,223.105,337.365,232.746 z" />
      <path fill="currentColor" d="M560.842,155.014c6.025-14.462,14.312-27.191,24.856-38.188s23.049-19.659,37.511-25.986 s30.129-9.49,47.001-9.49c16.571,0,31.937,3.013,46.098,9.038c14.16,6.026,26.362,14.387,36.606,25.083 c10.244,10.695,18.229,23.35,23.952,37.962c5.725,14.613,8.587,30.506,8.587,47.68v14.914H597.901 c1.507,9.34,4.52,18.002,9.039,25.985c4.52,7.984,10.168,14.914,16.947,20.789c6.779,5.876,14.462,10.471,23.049,13.784 c8.587,3.314,17.7,4.972,27.342,4.972c27.418,0,49.563-11.299,66.435-33.896l32.991,24.404 c-11.449,15.366-25.609,27.418-42.481,36.155c-16.873,8.737-35.854,13.106-56.944,13.106c-17.174,0-33.217-3.014-48.131-9.039 s-27.869-14.462-38.866-25.309s-19.659-23.576-25.986-38.188s-9.491-30.506-9.491-47.679 C551.803,184.842,554.817,169.476,560.842,155.014z M624.339,137.162c-12.805,10.696-21.316,24.932-25.534,42.708h140.552 c-3.917-17.776-12.278-32.012-25.083-42.708c-12.805-10.695-27.794-16.043-44.967-16.043 C652.133,121.119,637.144,126.467,624.339,137.162z" />
      <path fill="currentColor" d="M870.866,142.359c-9.641,10.545-14.462,24.856-14.462,42.934v131.062h-45.646V85.868h45.193v28.472 c5.725-9.34,13.182-16.722,22.371-22.145c9.189-5.424,20.111-8.136,32.766-8.136h15.817v42.482h-18.981 C892.86,126.542,880.507,131.814,870.866,142.359z" />
    </g>
  </svg>
);

const UberModal = ({ isOpen, onClose, onProductSelect, pickup, destination, fareEstimates }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const dragControls = useDragControls();

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
      name: 'Uber Chap Chap',
      description: 'Budget-friendly rides for daily commute',
      icon: <MotorcycleIcon className="w-10 h-10" />,
      productType: 'a5a0d0d4-8c0f-4c3c-9e89-0b2d8a2c7f2a'
    },
    {
      id: 'uberx',
      name: 'UberX',
      description: 'The standard premium ride choice',
      icon: <CarIcon className="w-10 h-10" />,
      productType: 'a1111c8c-c720-46c3-8534-2fcdd730040d'
    },
    {
      id: 'comfort',
      name: 'Uber Comfort',
      description: 'Spacious cars with top-rated drivers',
      icon: <HappyIcon className="w-10 h-10" />,
      productType: 'UberComfort'
    },
    {
      id: 'uberxl',
      name: 'UberXL',
      description: 'Reliable vans for up to 6 people',
      icon: <VanIcon className="w-10 h-10" />,
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

  const handleDragEnd = (event, info) => {
    if (info.offset.y > 100) {
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
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl overflow-hidden ${isDark ? 'bg-gray-900/98 backdrop-blur-2xl' : 'bg-white/98 backdrop-blur-2xl'
              } shadow-2xl border-t border-white/10`}
          >
            {/* Drag Handle Area - visual handle + large hit area for dragging */}
            <div
              className="w-full h-8 flex items-center justify-center cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div
                className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-300'
                  }`}
              />
            </div>

            <div className={`p-6 pt-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <div
                  className="flex items-center gap-3"
                  onPointerDown={(e) => dragControls.start(e)}
                >
                  <UberLogo className={`h-6 w-auto ${isDark ? 'text-white' : 'text-black'}`} />
                  <div className={`w-[2px] h-6 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                  <h3
                    className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'
                      }`}
                  >
                    Ride Options
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
                    }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p
                className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Select your preferred ride type
                <br />
                <span className="text-[10px] text-ios-blue-400 font-black uppercase tracking-[0.15em] mt-1.5 block">Nairobi Metro Rates • No Discount</span>
              </p>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh] green-scrollbar">
              {uberProducts.map((product) => {
                const fare = getFareForProduct(product.id);
                return (
                  <motion.button
                    key={product.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleProductSelect(product)}
                    className={`w-full text-left p-5 rounded-[2rem] border-2 transition-all duration-300 ${isDark
                      ? 'bg-gray-800/40 border-gray-800 hover:border-ios-blue-500/50 hover:bg-gray-800/60'
                      : 'bg-gray-50/50 border-gray-100 hover:border-ios-blue hover:bg-white shadow-sm hover:shadow-md'
                      } group`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-5">
                        <div className={`p-3 rounded-2xl transition-colors duration-300 ${isDark ? 'bg-gray-900/50 text-ios-blue-400 group-hover:text-ios-blue-300' : 'bg-white shadow-inner text-ios-blue group-hover:text-ios-blue-600'}`}>
                          {product.icon}
                        </div>
                        <div>
                          <h4 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                            {product.name}
                          </h4>
                          <p className={`text-xs font-semibold leading-tight opacity-70 ${isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                            {product.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {fare ? (
                          <>
                            <span className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'
                              }`}>
                              {formatFare(fare.total)}
                            </span>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-ios-blue-400' : 'bg-ios-blue'}`} />
                              <p className={`text-[11px] font-bold ${isDark ? 'text-ios-blue-400' : 'text-ios-blue'
                                }`}>
                                ~{fare.estimatedMinutes} min
                              </p>
                            </div>
                          </>
                        ) : (
                          <span className={`text-sm font-bold opacity-40 ${isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                            Unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className={`p-6 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'
              }`}>
              <button
                onClick={onClose}
                className={`w-full py-4 px-6 rounded-2xl font-black text-lg transition-all active:scale-[0.98] shadow-lg ${isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-white shadow-black/20'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900 shadow-gray-200/50'
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
