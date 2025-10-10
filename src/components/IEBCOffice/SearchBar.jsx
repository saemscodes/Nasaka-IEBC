import React from 'react';
import { motion } from 'framer-motion';

const SearchBar = ({ value, onChange, onFocus, placeholder = "Search..." }) => {
  return (
    <motion.div
      className="relative flex-1"
      whileTap={{ scale: 0.995 }}
    >
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ios-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-ios-gray-100 rounded-xl text-ios-gray-900 placeholder-ios-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue/20 focus:bg-white transition-all duration-200"
        />
        
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-ios-gray-200 transition-colors"
          >
            <svg className="w-4 h-4 text-ios-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default SearchBar;
