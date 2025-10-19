// contexts/SearchContext.jsx
import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { debounce } from '@/lib/searchUtils';

const SearchContext = createContext();

// Action types
const SEARCH_START = 'SEARCH_START';
const SEARCH_SUCCESS = 'SEARCH_SUCCESS';
const SEARCH_ERROR = 'SEARCH_ERROR';
const SET_QUERY = 'SET_QUERY';
const SET_SUGGESTIONS = 'SET_SUGGESTIONS';
const CLEAR_SEARCH = 'CLEAR_SEARCH';

// Reducer
const searchReducer = (state, action) => {
  switch (action.type) {
    case SEARCH_START:
      return {
        ...state,
        isLoading: true,
        error: null,
        searchSource: action.payload.source
      };
    
    case SEARCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        results: action.payload.results,
        error: null,
        lastSearchQuery: state.currentQuery
      };
    
    case SEARCH_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
        results: []
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
    
    case CLEAR_SEARCH:
      return {
        ...state,
        currentQuery: '',
        results: [],
        suggestions: [],
        error: null,
        isLoading: false
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
  searchSource: 'ui', // 'ui' or 'url'
  fromUrl: false
};

export const SearchProvider = ({ children, searchFunction, getSuggestionsFunction }) => {
  const [state, dispatch] = useReducer(searchReducer, initialState);
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Debounced search function
  const performSearch = useCallback(debounce(async (query, source = 'ui') => {
    if (!query.trim()) {
      dispatch({ type: CLEAR_SEARCH });
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    dispatch({ 
      type: SEARCH_START, 
      payload: { source } 
    });

    try {
      const results = await searchFunction(query, abortControllerRef.current.signal);
      dispatch({ 
        type: SEARCH_SUCCESS, 
        payload: { results } 
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        dispatch({ 
          type: SEARCH_ERROR, 
          payload: { error: error.message } 
        });
      }
    }
  }, 300), [searchFunction]);

  // Set query and optionally trigger search
  const setQuery = useCallback((query, options = {}) => {
    const { fromUrl = false, triggerSearch = true } = options;
    
    dispatch({ 
      type: SET_QUERY, 
      payload: { query, fromUrl } 
    });

    if (triggerSearch && query.trim()) {
      performSearch(query, fromUrl ? 'url' : 'ui');
    } else if (!query.trim()) {
      dispatch({ type: CLEAR_SEARCH });
    }
  }, [performSearch]);

  // Get suggestions
  const getSuggestions = useCallback(debounce(async (query) => {
    if (!query.trim() || !getSuggestionsFunction) {
      dispatch({ type: SET_SUGGESTIONS, payload: { suggestions: [] } });
      return;
    }

    try {
      const suggestions = await getSuggestionsFunction(query);
      dispatch({ 
        type: SET_SUGGESTIONS, 
        payload: { suggestions } 
      });
    } catch (error) {
      console.warn('Failed to get suggestions:', error);
    }
  }, 200), [getSuggestionsFunction]);

  // Clear search
  const clearSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    dispatch({ type: CLEAR_SEARCH });
  }, []);

  // Select result
  const selectResult = useCallback((result) => {
    // This will be handled by the component that uses the context
    return result;
  }, []);

  const value = {
    ...state,
    setQuery,
    performSearch,
    getSuggestions,
    clearSearch,
    selectResult
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
