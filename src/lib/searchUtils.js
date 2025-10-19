// lib/searchUtils.js

/**
 * Comprehensive search utilities for normalization, debouncing, URL management,
 * abort control, and geolocation calculations with full error handling and SSR support.
 */

/**
 * Normalizes URL query parameters for search with enhanced error handling
 * - Handles nested encoding with multiple decode attempts
 * - Robust fallback for malformed URLs
 * - Consistent 200 character limit
 */
export const normalizeQuery = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  
  const MAX_LENGTH = 200;
  
  try {
    let decoded = raw;
    
    // Multiple decode attempts for nested encoding
    for (let i = 0; i < 3; i++) {
      try {
        const temp = decodeURIComponent(decoded);
        if (temp === decoded) break;
        decoded = temp;
      } catch (e) {
        break;
      }
    }
    
    // Replace + with space and collapse multiple spaces
    decoded = decoded.replace(/\+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
    
    return decoded.slice(0, MAX_LENGTH);
  } catch (error) {
    // Comprehensive fallback normalization
    try {
      console.warn('URL decode failed, using fallback normalization:', error);
    } catch (e) {
      // Ignore console issues in restricted environments
    }
    
    return raw.replace(/%20/g, ' ')
             .replace(/\+/g, ' ')
             .replace(/\s+/g, ' ')
             .replace(/[^\w\s\-.,!?@#&]/g, '')
             .trim()
             .slice(0, MAX_LENGTH);
  }
};

/**
 * Enhanced debounce function with cancellation and immediate execution support
 * - Maintains function context and arguments
 * - Provides cancel() method for cleanup
 * - Supports immediate execution mode
 */
export const debounce = (func, wait = 300, immediate = false) => {
  let timeout;
  let result;
  
  const executedFunction = function(...args) {
    const context = this;
    const later = () => {
      timeout = null;
      if (!immediate) result = func.apply(context, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) result = func.apply(context, args);
    
    return result;
  };
  
  executedFunction.cancel = () => {
    clearTimeout(timeout);
    timeout = null;
  };
  
  return executedFunction;
};

/**
 * Update URL query parameters without page reload
 * - Supports both pushState and replaceState
 * - Handles pathname updates
 * - Uses normalized query for consistency
 * - SSR-safe with comprehensive error handling
 */
export const updateUrlQuery = (query, replace = false, pathname = undefined) => {
  if (typeof window === 'undefined') return;
  
  // Handle both boolean and object syntax for backwards compatibility
  let useReplace = Boolean(replace);
  let pathOverride = pathname;
  
  if (replace && typeof replace === 'object') {
    useReplace = Boolean(replace.replace);
    if (typeof replace.pathname === 'string') {
      pathOverride = replace.pathname;
    }
  }
  
  try {
    const url = new URL(window.location.href);
    const normalizedQuery = normalizeQuery(query);
    
    if (!normalizedQuery) {
      url.searchParams.delete('q');
    } else {
      url.searchParams.set('q', normalizedQuery);
    }
    
    if (typeof pathOverride === 'string' && pathOverride.length > 0) {
      url.pathname = pathOverride.startsWith('/') ? pathOverride : `/${pathOverride}`;
    }
    
    const method = useReplace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', url.toString());
  } catch (error) {
    console.warn('Error updating URL query:', error);
  }
};

/**
 * Advanced AbortController with reset capability for search requests
 * - Automatic controller reset after abort
 * - Polyfill-safe for unsupported environments
 * - Simple abort status tracking
 */
export class SearchAbortController {
  constructor() {
    this._aborted = false;
    this._controller = this._createController();
  }
  
  _createController() {
    if (typeof AbortController === 'undefined') {
      return {
        signal: { aborted: false },
        abort: () => {}
      };
    }
    return new AbortController();
  }
  
  abort() {
    this._aborted = true;
    if (this._controller && typeof this._controller.abort === 'function') {
      this._controller.abort();
    }
    // Reset controller for potential reuse
    this._controller = this._createController();
  }
  
  get signal() {
    return this._controller.signal;
  }
  
  get isAborted() {
    return this._aborted;
  }
  
  reset() {
    this._aborted = false;
    this._controller = this._createController();
  }
}

/**
 * Safe URL parameter extraction with error handling
 * - Returns plain object of all URL parameters
 * - SSR-safe with empty object fallback
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
 * Extract and normalize search query from current URL
 * - SSR-safe with empty string fallback
 * - Uses normalizeQuery for consistency
 */
export const getCurrentSearchQuery = () => {
  if (typeof window === 'undefined') return '';
  
  try {
    const params = new URLSearchParams(window.location.search);
    return normalizeQuery(params.get('q'));
  } catch (error) {
    console.warn('Error extracting search query:', error);
    return '';
  }
};

/**
 * Validate geographic coordinates
 * - Checks numeric ranges and validity
 * - Handles null/undefined inputs safely
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
 * Calculate Haversine distance between coordinates with validation
 * - Returns distance in kilometers
 * - Null return for invalid coordinates
 * - Comprehensive error handling
 */
export const calculateSafeDistance = (lat1, lon1, lat2, lon2) => {
  if (!validateCoordinates(lat1, lon1) || !validateCoordinates(lat2, lon2)) {
    return null;
  }
  
  try {
    const R = 6371; // Earth's radius in kilometers
    const toRad = (degree) => degree * Math.PI / 180;
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  } catch (error) {
    console.warn('Distance calculation failed:', error);
    return null;
  }
};

/**
 * Check if current environment supports all required Web APIs
 * - Verifies URL, History, and AbortController APIs
 * - SSR-safe with false return
 */
export const isSearchSupported = () => {
  if (typeof window === 'undefined') return false;
  
  return (
    typeof URL !== 'undefined' &&
    typeof URLSearchParams !== 'undefined' &&
    typeof AbortController !== 'undefined' &&
    'history' in window &&
    'pushState' in window.history &&
    'replaceState' in window.history
  );
};

/**
 * Safe session storage utility for search state persistence
 * - Handles storage errors gracefully
 * - SSR-safe with fallback to memory
 */
export const createSearchSession = (key = 'search-state') => {
  const memoryStore = new Map();
  
  return {
    set: (data) => {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(key, JSON.stringify(data));
        } else {
          memoryStore.set(key, data);
        }
      } catch (error) {
        console.warn('Session storage failed, using memory fallback:', error);
        memoryStore.set(key, data);
      }
    },
    
    get: () => {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const item = window.sessionStorage.getItem(key);
          return item ? JSON.parse(item) : null;
        }
        return memoryStore.get(key) || null;
      } catch (error) {
        console.warn('Session storage read failed:', error);
        return memoryStore.get(key) || null;
      }
    },
    
    clear: () => {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem(key);
        }
        memoryStore.delete(key);
      } catch (error) {
        console.warn('Session storage clear failed:', error);
      }
    }
  };
};

// Export a default object for convenience
export default {
  normalizeQuery,
  debounce,
  updateUrlQuery,
  SearchAbortController,
  getSafeURLParams,
  getCurrentSearchQuery,
  validateCoordinates,
  calculateSafeDistance,
  isSearchSupported,
  createSearchSession
};
