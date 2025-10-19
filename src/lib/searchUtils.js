// lib/searchUtils.js
export function normalizeQuery(raw) {
  if (!raw) return '';
  
  try {
    let decoded = decodeURIComponent(raw);
    // Replace + with spaces and handle multiple spaces
    decoded = decoded.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
    return decoded.slice(0, 200);
  } catch (e) {
    // If decode fails, fallback to basic replacement
    let decoded = raw.replace(/\+/g, ' ').replace(/%20/g, ' ');
    decoded = decoded.replace(/\s+/g, ' ').trim();
    return decoded.slice(0, 200);
  }
}

export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Helper to update URL without page reload
export function updateUrlQuery(query, replace = false) {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.href);
  if (query) {
    url.searchParams.set('q', query);
  } else {
    url.searchParams.delete('q');
  }
  
  if (replace) {
    window.history.replaceState({}, '', url.toString());
  } else {
    window.history.pushState({}, '', url.toString());
  }
}
