// lib/searchUtils.js

/**
 * Normalizes URL query parameters for search with enhanced error handling
 */
export const normalizeQuery = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  
  try {
    // Decode URI component safely with multiple fallbacks
    let decoded = raw;
    
    // Multiple decode attempts for nested encoding
    for (let i = 0; i < 3; i++) {
      try {
        const temp = decodeURIComponent(decoded);
        if (temp === decoded) break; // No more decoding needed
        decoded = temp;
      } catch (e) {
        break; // Stop if decoding fails
      }
    }
    
    // Replace + with space and collapse multiple spaces
    decoded = decoded.replace(/\+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
    
    // Limit length to prevent abuse and performance issues
    return decoded.slice(0, 200);
  } catch (error) {
    console.warn('URL decode failed, using fallback normalization:', error);
    // Comprehensive fallback normalization
    return raw.replace(/%20/g, ' ')
             .replace(/\+/g, ' ')
             .replace(/\s+/g, ' ')
             .replace(/[^\w\s\-.,!?@#&]/g, '') // Remove problematic characters
             .trim()
             .slice(0, 200);
  }
};

/**
 * Enhanced debounce function with cancellation support
 */
export const debounce = (func, wait = 300, immediate = false) => {
  let timeout;
  let result;
  
  const executedFunction = function(...args) {
    const context = this;
    const later = function() {
      timeout = null;
      if (!immediate) result = func.apply(context, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) result = func.apply(context, args);
    
    return result;
  };
  
  executedFunction.cancel = function() {
    clearTimeout(timeout);
    timeout = null;
  };
  
  return executedFunction;
};

/**
 * Advanced AbortController utility for search requests
 */
export class SearchAbortController {
  constructor() {
    this.controller = new AbortController();
    this.aborted = false;
  }

  abort() {
    this.aborted = true;
    this.controller.abort();
    this.controller = new AbortController();
  }

  get signal() {
    return this.controller.signal;
  }

  get isAborted() {
    return this.aborted;
  }
}

/**
 * Safe URL parameter extraction
 */
export const getSafeURLParams = () => {
  if (typeof window === 'undefined') return {};
  
  try {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    
    return result;
  } catch (error) {
    console.warn('Error parsing URL parameters:', error);
    return {};
  }
};

/**
 * Validate coordinates for routing
 */
export const validateCoordinates = (lat, lng) => {
  if (lat == null || lng == null) return false;
  
  const numLat = Number(lat);
  const numLng = Number(lng);
  
  return !isNaN(numLat) && 
         !isNaN(numLng) && 
         numLat >= -90 && 
         numLat <= 90 && 
         numLng >= -180 && 
         numLng <= 180;
};

/**
 * Calculate distance between coordinates with validation
 */
export const calculateSafeDistance = (lat1, lon1, lat2, lon2) => {
  if (!validateCoordinates(lat1, lon1) || !validateCoordinates(lat2, lon2)) {
    return null;
  }
  
  try {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  } catch (error) {
    console.warn('Distance calculation failed:', error);
    return null;
  }
};
