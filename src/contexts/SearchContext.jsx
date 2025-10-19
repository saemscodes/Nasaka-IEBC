// contexts/SearchContext.jsx
import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { debounce, SearchAbortController } from '@/lib/searchUtils';

const SearchContext = createContext();

// Action types
const SEARCH_START = 'SEARCH_START';
const SEARCH_SUCCESS = 'SEARCH_SUCCESS';
const SEARCH_ERROR = 'SEARCH_ERROR';
const SET_QUERY = 'SET_QUERY';
const SET_SUGGESTIONS = 'SET_SUGGESTIONS';
const CLEAR_SEARCH = 'CLEAR_SEARCH';
const SET_ROUTE_DATA = 'SET_ROUTE_DATA';
const CLEAR_ROUTES = 'CLEAR_ROUTES';

// Reducer
const searchReducer = (state, action) => {
  switch (action.type) {
    case SEARCH_START:
      return {
        ...state,
        isLoading: true,
        error: null,
        searchSource: action.payload.source,
        lastSearchTime: Date.now()
      };
    
    case SEARCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        results: action.payload.results,
        error: null,
        lastSearchQuery: state.currentQuery,
        searchDuration: Date.now() - state.lastSearchTime
      };
    
    case SEARCH_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
        results: [],
        searchDuration: Date.now() - state.lastSearchTime
      };
    
    case SET_QUERY:
      return {
        ...state,
        currentQuery: action.payload.query,
        fromUrl: action.payload.fromUrl || false
      };
    
    case SET_SUGGESTIONS:
      return {
        ...state,
        suggestions: action.payload.suggestions
      };
    
    case SET_ROUTE_DATA:
      return {
        ...state,
        currentRoutes: action.payload.routes,
        routingError: action.payload.error || null
      };
    
    case CLEAR_ROUTES:
      return {
        ...state,
        currentRoutes: null,
        routingError: null
      };
    
    case CLEAR_SEARCH:
      return {
        ...state,
        currentQuery: '',
        results: [],
        suggestions: [],
        error: null,
        isLoading: false,
        currentRoutes: null,
        routingError: null
      };
    
    default:
      return state;
  }
};

const initialState = {
  currentQuery: '',
  results: [],
  suggestions: [],
  isLoading: false,
  error: null,
  lastSearchQuery: '',
  searchSource: 'ui',
  fromUrl: false,
  currentRoutes: null,
  routingError: null,
  lastSearchTime: 0,
  searchDuration: 0
};

export const SearchProvider = ({ children, searchFunction, getSuggestionsFunction }) => {
  const [state, dispatch] = useReducer(searchReducer, initialState);
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const lastProcessedQueryRef = useRef('');

  // Enhanced search cancellation
  const cancelSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  }, []);

  // Enhanced search function with duplicate prevention
  const performSearch = useCallback(debounce(async (query, source = 'ui') => {
    const normalizedQuery = query.trim();
    
    // Prevent duplicate searches
    if (normalizedQuery === lastProcessedQueryRef.current) {
      return;
    }

    if (!normalizedQuery) {
      dispatch({ type: CLEAR_SEARCH });
      lastProcessedQueryRef.current = '';
      return;
    }

    // Cancel previous request
    cancelSearch();
    
    abortControllerRef.current = new SearchAbortController();
    lastProcessedQueryRef.current = normalizedQuery;
    
    dispatch({ 
      type: SEARCH_START, 
      payload: { source } 
    });

    try {
      const results = await searchFunction(normalizedQuery, abortControllerRef.current.signal);
      
      // Only update if not aborted and query hasn't changed
      if (!abortControllerRef.current?.isAborted && lastProcessedQueryRef.current === normalizedQuery) {
        dispatch({ 
          type: SEARCH_SUCCESS, 
          payload: { results } 
        });
      }
    } catch (error) {
      if (error.name !== 'AbortError' && lastProcessedQueryRef.current === normalizedQuery) {
        dispatch({ 
          type: SEARCH_ERROR, 
          payload: { error: error.message } 
        });
      }
    }
  }, 400), [searchFunction, cancelSearch]);

  // Set query with enhanced validation
  const setQuery = useCallback((query, options = {}) => {
    const { fromUrl = false, triggerSearch = true, force = false } = options;
    
    const normalizedQuery = query.trim();
    
    // Prevent unnecessary updates
    if (!force && normalizedQuery === state.currentQuery && fromUrl === state.fromUrl) {
      return;
    }
    
    dispatch({ 
      type: SET_QUERY, 
      payload: { query: normalizedQuery, fromUrl } 
    });

    if (triggerSearch && normalizedQuery) {
      performSearch(normalizedQuery, fromUrl ? 'url' : 'ui');
    } else if (!normalizedQuery) {
      dispatch({ type: CLEAR_SEARCH });
      lastProcessedQueryRef.current = '';
    }
  }, [state.currentQuery, state.fromUrl, performSearch]);

  // Enhanced suggestions with cancellation
  const getSuggestions = useCallback(debounce(async (query) => {
    const normalizedQuery = query.trim();
    
    if (!normalizedQuery || !getSuggestionsFunction) {
      dispatch({ type: SET_SUGGESTIONS, payload: { suggestions: [] } });
      return;
    }

    try {
      const suggestions = await getSuggestionsFunction(normalizedQuery);
      dispatch({ 
        type: SET_SUGGESTIONS, 
        payload: { suggestions } 
      });
    } catch (error) {
      console.warn('Failed to get suggestions:', error);
    }
  }, 250), [getSuggestionsFunction]);

  // Route management
  const setRouteData = useCallback((routes, error = null) => {
    dispatch({ 
      type: SET_ROUTE_DATA, 
      payload: { routes, error } 
    });
  }, []);

  const clearRoutes = useCallback(() => {
    dispatch({ type: CLEAR_ROUTES });
  }, []);

  // Enhanced clear search
  const clearSearch = useCallback(() => {
    cancelSearch();
    lastProcessedQueryRef.current = '';
    dispatch({ type: CLEAR_SEARCH });
  }, [cancelSearch]);

  // Select result
  const selectResult = useCallback((result) => {
    return result;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelSearch();
    };
  }, [cancelSearch]);

  const value = {
    ...state,
    setQuery,
    performSearch,
    getSuggestions,
    clearSearch,
    selectResult,
    setRouteData,
    clearRoutes,
    cancelSearch
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
