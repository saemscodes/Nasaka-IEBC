// lib/searchUtils.js

/**
 * Normalizes URL query parameters for search
 */
export const normalizeQuery = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  
  try {
    // Decode URI component safely
    let decoded = decodeURIComponent(raw);
    
    // Replace + with space and collapse multiple spaces
    decoded = decoded.replace(/\+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
    
    // Limit length to prevent abuse
    return decoded.slice(0, 200);
  } catch (error) {
    // Fallback for double-encoding or malformed URLs
    console.warn('URL decode failed, using fallback normalization:', error);
    return raw.replace(/%20/g, ' ')
             .replace(/\+/g, ' ')
             .replace(/\s+/g, ' ')
             .trim()
             .slice(0, 200);
  }
};

/**
 * Debounce function for search operations
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * AbortController utility for search requests
 */
export class SearchAbortController {
  constructor() {
    this.controller = new AbortController();
  }

  abort() {
    this.controller.abort();
    this.controller = new AbortController();
  }

  get signal() {
    return this.controller.signal;
  }
}
