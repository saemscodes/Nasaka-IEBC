// lib/searchUtils.js

/**
 * Normalizes URL query parameters for search with enhanced error handling
 */
export const normalizeQuery = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  
  const MAX_LEN = 200;
  let input = typeof raw === 'string' ? raw : String(raw);

  try {
    let decoded = input;
    for (let i = 0; i < 3; i++) {
      try {
        const temp = decodeURIComponent(decoded);
        if (temp === decoded) break;
        decoded = temp;
      } catch (e) {
        break;
      }
    }

    decoded = decoded.replace(/\+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
    return decoded.slice(0, MAX_LEN);
  } catch (error) {
    try {
      console.warn('URL decode failed, using fallback normalization:', error);
    } catch (e) {}

    return input
      .replace(/%20/g, ' ')
      .replace(/\+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,!?@#&]/g, '')
      .trim()
      .slice(0, MAX_LEN);
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
 * Helper to update URL without page reload
 */
export const updateUrlQuery = (query, replace = false, pathname = undefined) => {
  if (typeof window === 'undefined') return;

  let useReplace = Boolean(replace);
  let pathOverride = pathname;
  if (replace && typeof replace === 'object') {
    useReplace = Boolean(replace.replace);
    if (typeof replace.pathname === 'string') pathOverride = replace.pathname;
  }

  try {
    const url = new URL(window.location.href);
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
      url.searchParams.delete('q');
    } else {
      url.searchParams.set('q', normalizedQuery);
    }

    if (typeof pathOverride === 'string' && pathOverride.length) {
      url.pathname = pathOverride.startsWith('/') ? pathOverride : `/${pathOverride}`;
    }

    const newUrl = url.toString();
    if (useReplace) window.history.replaceState({}, '', newUrl);
    else window.history.pushState({}, '', newUrl);
  } catch (err) {}
};

/**
 * Advanced AbortController utility for search requests
 */
export class SearchAbortController {
  constructor() {
    if (typeof AbortController !== 'undefined') {
      this.controller = new AbortController();
    } else {
      this.controller = { signal: null, abort: () => {} };
    }
    this.aborted = false;
  }

  abort() {
    this.aborted = true;
    if (this.controller && typeof this.controller.abort === 'function') {
      try {
        this.controller.abort();
      } catch (e) {}
    }
    if (typeof AbortController !== 'undefined') {
      this.controller = new AbortController();
    } else {
      this.controller = { signal: null, abort: () => {} };
    }
  }

  get signal() {
    return this.controller ? this.controller.signal : null;
  }

  get isAborted() {
    return !!this.aborted;
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

  return !Number.isNaN(numLat) &&
         !Number.isNaN(numLng) &&
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
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  } catch (error) {
    return null;
  }
};

/**
 * Extract search query from current URL safely
 */
export const getCurrentSearchQuery = () => {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    return normalizeQuery(params.get('q'));
  } catch (error) {
    return '';
  }
};

/**
 * Check if environment supports all required APIs
 */
export const isSearchSupported = () => {
  return (
    typeof window !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URLSearchParams !== 'undefined' &&
    'history' in window &&
    typeof window.history.pushState === 'function'
  );
};
