// src/lib/searchUtils.js
/**
 * Comprehensive search utilities for IEBC Office Finder
 * Enhanced with advanced query normalization, URL handling, and offline support
 */

// ==================== CORE UTILITIES ====================

/**
 * Enhanced debounce with immediate execution option and cancellation
 * @param {Function} func - Function to debounce
 * @param {number} wait - Debounce wait time in ms
 * @param {Object} options - Additional options
 * @param {boolean} options.leading - Execute immediately on first call
 * @param {number} options.maxWait - Maximum wait time before forced execution
 * @returns {Function} Debounced function with cancel capability
 */
export function debounce(func, wait = 300, options = {}) {
  let timeout;
  let lastCallTime;
  let lastInvokeTime = 0;
  let result;
  
  const { leading = false, maxWait } = options;
  
  function invokeFunc(time) {
    const args = Array.prototype.slice.call(arguments, 1);
    result = func.apply(this, args);
    lastInvokeTime = time;
    return result;
  }
  
  function leadingEdge(time) {
    lastInvokeTime = time;
    timeout = setTimeout(timerExpired, wait);
    return leading ? invokeFunc(time) : result;
  }
  
  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;
    
    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }
  
  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    
    return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
            (timeSinceLastCall < 0) || (maxWait !== undefined && timeSinceLastInvoke >= maxWait));
  }
  
  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timeout = setTimeout(timerExpired, remainingWait(time));
  }
  
  function trailingEdge(time) {
    timeout = undefined;
    
    if (!leading) {
      return invokeFunc(time);
    }
    return result;
  }
  
  function cancel() {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    lastCallTime = 0;
    lastInvokeTime = 0;
    timeout = undefined;
  }
  
  function flush() {
    return timeout === undefined ? result : trailingEdge(Date.now());
  }
  
  function debounced() {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);
    
    lastCallTime = time;
    
    if (isInvoking) {
      if (timeout === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait !== undefined) {
        timeout = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timeout === undefined) {
      timeout = setTimeout(timerExpired, wait);
    }
    return result;
  }
  
  debounced.cancel = cancel;
  debounced.flush = flush;
  
  return debounced;
}

/**
 * Simple throttle function for performance optimization
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ==================== QUERY NORMALIZATION ====================

/**
 * Normalizes search queries with comprehensive cleaning and validation
 * @param {string} raw - Raw input query
 * @returns {string} Normalized and sanitized query
 */
export function normalizeQuery(raw) {
  if (!raw || typeof raw !== 'string') return '';
  
  try {
    // Decode URL components first
    let decoded = decodeURIComponent(raw);
    
    // Comprehensive cleaning sequence
    decoded = decoded
      // Replace URL encoding with spaces
      .replace(/\+/g, ' ')
      .replace(/%20/g, ' ')
      .replace(/%2B/g, ' ')
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Trim and normalize
      .trim()
      // Remove special characters that might break search
      .replace(/[<>"']/g, '')
      // Normalize to consistent case for better matching
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, ' '); // Replace special chars with space
    
    // Additional normalization for common IEBC office patterns
    decoded = decoded
      // Handle county suffixes
      .replace(/\bcounty\b/gi, '')
      .replace(/\bconstituency\b/gi, '')
      // Remove extra spaces from normalization
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit length for performance and security
    return decoded.slice(0, 200);
    
  } catch (e) {
    // Fallback normalization if decode fails
    console.warn('Query normalization failed, using fallback:', e);
    let fallback = String(raw || '')
      .replace(/\+/g, ' ')
      .replace(/%20/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    return fallback.slice(0, 200);
  }
}

/**
 * Alternative simple normalization (compatibility)
 * @param {string} term - Search term to normalize
 * @returns {string} Normalized term
 */
export function normalizeSearchTerm(term) {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

// ==================== TEXT MANIPULATION ====================

/**
 * Escape special regex characters in a string
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight matching text in search results
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {string} HTML with highlighted text
 */
export function highlightText(text, query) {
  if (!query || !text) return text;
  
  const escapedQuery = escapeRegExp(query);
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Advanced search highlighting with match boundaries
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @param {Object} options - Highlighting options
 * @returns {string} Highlighted text
 */
export function highlightSearchMatches(text, query, options = {}) {
  if (!text || !query) return text;
  
  const {
    highlightTag = 'mark',
    highlightClass = 'search-highlight',
    caseSensitive = false
  } = options;
  
  const normalizedText = String(text);
  const normalizedQuery = normalizeQuery(query);
  
  if (!normalizedQuery) return normalizedText;
  
  const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0);
  let result = normalizedText;
  
  queryWords.forEach(word => {
    const regex = new RegExp(`(${escapeRegExp(word)})`, caseSensitive ? 'g' : 'gi');
    result = result.replace(regex, `<${highlightTag} class="${highlightClass}">$1</${highlightTag}>`);
  });
  
  return result;
}

// ==================== RELEVANCE SCORING ====================

/**
 * Advanced query scoring for search relevance
 * @param {string} query - Search query
 * @param {string} text - Text to score against
 * @param {Object} options - Scoring options
 * @returns {number} Relevance score (0-1)
 */
export function calculateRelevanceScore(query, text, options = {}) {
  if (!query || !text) return 0;
  
  const {
    exactMatchBoost = 2.0,
    partialMatchBoost = 1.0,
    wordOrderPenalty = 0.1,
    minMatchThreshold = 0.3
  } = options;
  
  const normalizedQuery = normalizeQuery(query).toLowerCase();
  const normalizedText = String(text || '').toLowerCase();
  
  if (normalizedQuery === normalizedText) {
    return 1.0; // Perfect match
  }
  
  let score = 0;
  
  // Exact substring match
  if (normalizedText.includes(normalizedQuery)) {
    score += exactMatchBoost;
  }
  
  // Word-based matching
  const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 1);
  const textWords = normalizedText.split(/\s+/);
  
  let matchedWords = 0;
  let wordPositionScore = 0;
  
  queryWords.forEach((queryWord, queryIndex) => {
    textWords.forEach((textWord, textIndex) => {
      if (textWord.includes(queryWord)) {
        matchedWords++;
        // Reward words that appear in similar positions
        const positionSimilarity = 1 - Math.abs(queryIndex - textIndex) / Math.max(queryWords.length, textWords.length);
        wordPositionScore += positionSimilarity;
      }
    });
  });
  
  if (matchedWords > 0) {
    const wordMatchRatio = matchedWords / queryWords.length;
    const positionScore = wordPositionScore / matchedWords;
    
    score += (wordMatchRatio * partialMatchBoost) + (positionScore * (1 - wordOrderPenalty));
  }
  
  // Normalize score to 0-1 range
  const maxPossibleScore = exactMatchBoost + (queryWords.length * partialMatchBoost);
  const normalizedScore = Math.min(score / maxPossibleScore, 1.0);
  
  return normalizedScore >= minMatchThreshold ? normalizedScore : 0;
}

/**
 * Calculate relevance score for IEBC office items
 * @param {Object} item - Office item
 * @param {string} query - Search query
 * @param {Object} weights - Weight configuration
 * @returns {number} Relevance score
 */
export function calculateItemRelevanceScore(item, query, weights = {
  exactMatch: 10,
  startsWith: 5,
  contains: 1,
  fuzzyMatch: 0.5
}) {
  const normalizedQuery = normalizeSearchTerm(query);
  let score = 0;
  
  // Search in various fields
  const searchFields = [
    item.county,
    item.constituency_name,
    item.constituency,
    item.office_location,
    item.landmark,
    item.formatted_address
  ].filter(Boolean);
  
  for (const field of searchFields) {
    const normalizedField = normalizeSearchTerm(field);
    
    if (normalizedField === normalizedQuery) {
      score += weights.exactMatch;
    } else if (normalizedField.startsWith(normalizedQuery)) {
      score += weights.startsWith;
    } else if (normalizedField.includes(normalizedQuery)) {
      score += weights.contains;
    } else {
      // Simple fuzzy matching
      const queryWords = normalizedQuery.split(' ');
      const fieldWords = normalizedField.split(' ');
      const matches = queryWords.filter(qw => 
        fieldWords.some(fw => fw.includes(qw))
      );
      score += matches.length * weights.fuzzyMatch;
    }
  }
  
  return score;
}

/**
 * Sort items by relevance to query
 * @param {Array} items - Items to sort
 * @param {string} query - Search query
 * @returns {Array} Sorted items
 */
export function sortByRelevance(items, query) {
  return items
    .map(item => ({
      ...item,
      relevanceScore: calculateItemRelevanceScore(item, query)
    }))
    .filter(item => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ==================== URL HANDLING ====================

/**
 * Enhanced URL query management with history state preservation
 * @param {string} query - Search query to set in URL
 * @param {Object} options - Configuration options
 */
export function updateUrlQuery(query, options = {}) {
  if (typeof window === 'undefined' || !window.location) return;
  
  const {
    replace = false,
    additionalParams = {},
    paramName = 'q',
    preserveHash = true
  } = options;
  
  const url = new URL(window.location.href);
  
  // Handle main search query parameter
  if (query && query.trim()) {
    const normalizedQuery = normalizeQuery(query.trim());
    if (normalizedQuery) {
      url.searchParams.set(paramName, normalizedQuery);
    } else {
      url.searchParams.delete(paramName);
    }
  } else {
    url.searchParams.delete(paramName);
  }
  
  // Handle additional parameters
  Object.entries(additionalParams).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    } else {
      url.searchParams.delete(key);
    }
  });
  
  // Preserve hash if requested
  const hash = preserveHash ? window.location.hash : '';
  
  // Build final URL
  let finalUrl = url.toString();
  if (hash && preserveHash) {
    finalUrl = finalUrl.split('#')[0] + hash;
  }
  
  // Update history
  const historyMethod = replace ? 'replaceState' : 'pushState';
  window.history[historyMethod]({ 
    searchQuery: query,
    timestamp: Date.now(),
    source: 'search_utils'
  }, '', finalUrl);
  
  // Dispatch custom event for other components to listen to
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('urlQueryUpdated', {
      detail: {
        query,
        normalizedQuery: query ? normalizeQuery(query) : '',
        url: finalUrl,
        method: historyMethod
      }
    }));
  }
}

/**
 * Parse current URL search parameters with normalization
 * @param {URLSearchParams} searchParams - URLSearchParams instance
 * @returns {Object} Parsed and normalized parameters
 */
export function parseUrlSearchParams(searchParams = null) {
  if (typeof window === 'undefined') return {};
  
  const params = searchParams || new URLSearchParams(window.location.search);
  const result = {};
  
  for (const [key, value] of params.entries()) {
    if (value) {
      result[key] = normalizeQuery(value);
    }
  }
  
  return result;
}

/**
 * Get specific parameter from URL with normalization
 * @param {string} param - Parameter name
 * @param {string} defaultValue - Default value if not found
 * @returns {string} Normalized parameter value
 */
export function getUrlParam(param, defaultValue = '') {
  if (typeof window === 'undefined') return defaultValue;
  
  const urlParams = new URLSearchParams(window.location.search);
  const value = urlParams.get(param);
  
  return value ? normalizeQuery(value) : defaultValue;
}

/**
 * Remove specific parameter from URL
 * @param {string} param - Parameter name to remove
 * @param {boolean} replace - Use replaceState instead of pushState
 */
export function removeUrlParam(param, replace = true) {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.href);
  url.searchParams.delete(param);
  
  const historyMethod = replace ? 'replaceState' : 'pushState';
  window.history[historyMethod]({}, '', url.toString());
  
  // Dispatch removal event
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('urlParamRemoved', {
      detail: { param, url: url.toString() }
    }));
  }
}

// ==================== SEARCH GENERATION ====================

/**
 * Generate search suggestions based on query and available data
 * @param {string} query - Current search query
 * @param {Array} data - Available data for suggestions
 * @param {Object} options - Suggestion generation options
 * @returns {Array} Array of search suggestions
 */
export function generateSearchSuggestions(query, data = [], options = {}) {
  if (!query || query.length < 2) return [];
  
  const {
    maxSuggestions = 5,
    minScore = 0.1,
    fields = ['name', 'county', 'constituency_name', 'office_location'],
    includeQuerySuggestions = true
  } = options;
  
  const normalizedQuery = normalizeQuery(query);
  const suggestions = [];
  
  // Generate suggestions from data
  data.forEach(item => {
    let bestScore = 0;
    let bestField = '';
    
    fields.forEach(field => {
      if (item[field]) {
        const score = calculateRelevanceScore(normalizedQuery, item[field], {
          exactMatchBoost: 3.0,
          partialMatchBoost: 1.5
        });
        
        if (score > bestScore && score >= minScore) {
          bestScore = score;
          bestField = field;
        }
      }
    });
    
    if (bestScore > 0) {
      suggestions.push({
        ...item,
        _searchScore: bestScore,
        _matchedField: bestField,
        type: 'suggestion'
      });
    }
  });
  
  // Sort by relevance score
  suggestions.sort((a, b) => b._searchScore - a._searchScore);
  
  const result = suggestions.slice(0, maxSuggestions);
  
  // Add query-based suggestions
  if (includeQuerySuggestions && normalizedQuery.length >= 2) {
    result.push({
      id: `search-${normalizedQuery}`,
      name: `Search for "${normalizedQuery}"`,
      subtitle: 'Find all matching IEBC offices',
      type: 'search_query',
      query: normalizedQuery,
      _searchScore: 0.9, // High score for query suggestions
      _matchedField: 'query'
    });
  }
  
  return result;
}

// ==================== BATCH PROCESSING ====================

/**
 * Performance-optimized batch search processing
 * @param {Array} items - Items to search through
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Array} Filtered and scored results
 */
export function batchSearch(items, query, options = {}) {
  if (!query || !items || !items.length) return [];
  
  const {
    fields = ['county', 'constituency_name', 'office_location', 'formatted_address'],
    minScore = 0.1,
    maxResults = 50,
    scoreThreshold = 0.3
  } = options;
  
  const normalizedQuery = normalizeQuery(query);
  const results = [];
  
  // Early return for empty query
  if (!normalizedQuery) return items.slice(0, maxResults);
  
  // Process items with scoring
  items.forEach(item => {
    let totalScore = 0;
    let fieldMatches = 0;
    
    fields.forEach(field => {
      if (item[field]) {
        const score = calculateRelevanceScore(normalizedQuery, item[field], {
          exactMatchBoost: 2.0,
          partialMatchBoost: 1.0
        });
        
        if (score >= minScore) {
          totalScore += score;
          fieldMatches++;
        }
      }
    });
    
    if (fieldMatches > 0) {
      const averageScore = totalScore / fieldMatches;
      if (averageScore >= scoreThreshold) {
        results.push({
          ...item,
          _searchScore: averageScore,
          _fieldMatches: fieldMatches
        });
      }
    }
  });
  
  // Sort by score and field matches
  results.sort((a, b) => {
    if (b._searchScore !== a._searchScore) {
      return b._searchScore - a._searchScore;
    }
    return b._fieldMatches - a._fieldMatches;
  });
  
  return results.slice(0, maxResults);
}

// ==================== ANALYTICS & TRACKING ====================

/**
 * Search analytics and tracking utilities
 * @param {string} action - Analytics action
 * @param {Object} data - Analytics data
 */
export function trackSearchEvent(action, data = {}) {
  if (typeof window === 'undefined') return;
  
  const eventData = {
    action,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    ...data
  };
  
  // Google Analytics 4
  if (window.gtag) {
    window.gtag('event', action, {
      search_term: data.query,
      search_source: data.source,
      search_results: data.resultsCount,
      event_timestamp: eventData.timestamp
    });
  }
  
  // Custom event dispatch for internal analytics
  if (window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('searchAnalytics', {
      detail: eventData
    }));
  }
  
  // Console logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Search Analytics:', eventData);
  }
}

// ==================== CACHE MANAGEMENT ====================

/**
 * Cache management for search results
 */
export class SearchCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.cache = new Map();
  }
  
  set(key, value) {
    this.cleanup();
    
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    // Check if item has expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  delete(key) {
    this.cache.delete(key);
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  clear() {
    this.cache.clear();
  }
  
  size() {
    return this.cache.size;
  }
}

// Create global search cache instance
export const globalSearchCache = new SearchCache({
  maxSize: 200,
  ttl: 10 * 60 * 1000 // 10 minutes
});

// ==================== DEFAULT EXPORT ====================

export default {
  // Core utilities
  debounce,
  throttle,
  escapeRegExp,
  
  // Normalization
  normalizeQuery,
  normalizeSearchTerm,
  
  // Text manipulation
  highlightText,
  highlightSearchMatches,
  
  // Relevance scoring
  calculateRelevanceScore,
  calculateItemRelevanceScore,
  sortByRelevance,
  
  // URL handling
  updateUrlQuery,
  parseUrlSearchParams,
  getUrlParam,
  removeUrlParam,
  
  // Search generation
  generateSearchSuggestions,
  
  // Batch processing
  batchSearch,
  
  // Analytics
  trackSearchEvent,
  
  // Cache
  SearchCache,
  globalSearchCache
};