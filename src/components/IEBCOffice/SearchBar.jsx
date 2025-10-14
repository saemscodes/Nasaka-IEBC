import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, MapPin, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Fuse from 'fuse.js';
import { useTheme } from '@/contexts/ThemeContext';

const SearchBar = ({ 
  value, 
  onChange, 
  onFocus, 
  onSearch,
  onLocationSearch,
  placeholder = "Search IEBC offices by county, constituency, or location...",
  className = ""
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allOffices, setAllOffices] = useState([]);
  const [fuse, setFuse] = useState(null);
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const { theme } = useTheme();

  // Load all offices for Fuse.js indexing
  useEffect(() => {
    loadAllOffices();
  }, []);

  const loadAllOffices = async () => {
    try {
      const { data, error } = await supabase
        .from('iebc_offices')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;

      setAllOffices(data || []);
      
      // Initialize Fuse.js for fuzzy search
      const fuseOptions = {
        keys: [
          'county',
          'constituency_name',
          'constituency',
          'office_location',
          'landmark',
          'clean_office_location',
          'formatted_address'
        ],
        threshold: 0.3,
        includeScore: true,
        includeMatches: true,
        minMatchCharLength: 2,
        shouldSort: true,
        findAllMatches: true
      };
      
      setFuse(new Fuse(data || [], fuseOptions));
    } catch (error) {
      console.error('Error loading offices for search:', error);
    }
  };

  // Enhanced search function with Fuse.js
  const performSearch = useCallback((searchTerm) => {
    if (!searchTerm.trim() || !fuse) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    
    try {
      const results = fuse.search(searchTerm).slice(0, 8);
      const formattedSuggestions = results.map(result => ({
        ...result.item,
        matches: result.matches,
        score: result.score,
        type: 'office'
      }));

      // Add search query suggestion
      if (searchTerm.length > 2) {
        formattedSuggestions.push({
          id: `search-${searchTerm}`,
          name: `Search for "${searchTerm}"`,
          subtitle: 'Find all matching IEBC offices',
          type: 'search_query',
          query: searchTerm
        });
      }

      setSuggestions(formattedSuggestions);
    } catch (error) {
      console.error('Search error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [fuse]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [value, performSearch]);

  const handleInputChange = (e) => {
    onChange(e.target.value);
    if (e.target.value.trim()) {
      setIsExpanded(true);
    }
  };

  const handleInputFocus = () => {
    setIsExpanded(true);
  };

  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.type === 'office' && onSearch) {
      onSearch(suggestion);
    } else if (suggestion.type === 'search_query' && onSearch) {
      onSearch({ searchQuery: suggestion.query });
    }
    setIsExpanded(false);
    setSuggestions([]);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setIsExpanded(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleUseCurrentLocation = () => {
    if (onLocationSearch) {
      onLocationSearch();
    }
    setIsExpanded(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (value.trim() && onSearch) {
        onSearch({ searchQuery: value.trim() });
        if (onFocus) onFocus();
      }
      setIsExpanded(false);
    }
  };

  // Enhanced highlightMatches with improved dark mode support
  const highlightMatches = (text, matches) => {
    if (!matches || !text) return text;

    const matchIndices = matches
      .flatMap(match => match.indices)
      .sort((a, b) => a[0] - b[0]);

    if (matchIndices.length === 0) return text;

    let result = [];
    let lastIndex = 0;

    matchIndices.forEach(([start, end]) => {
      if (start > lastIndex) {
        result.push(text.slice(lastIndex, start));
      }

      result.push(
        <span key={start} className={`px-1 rounded font-semibold transition-all duration-300 ${
          theme === 'dark' 
            ? 'bg-amber-400/80 text-amber-900 shadow-lg' 
            : 'bg-yellow-300/90 text-yellow-900 shadow-md'
        }`}>
          {text.slice(start, end + 1)}
        </span>
      );

      lastIndex = end + 1;
    });

    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result;
  };

  const getSuggestionDisplay = (suggestion) => {
    if (suggestion.type === 'search_query') {
      return {
        primary: suggestion.name,
        secondary: suggestion.subtitle
      };
    }

    const mainMatch = suggestion.matches?.[0];
    const countyMatch = suggestion.matches?.find(m => m.key === 'county');
    const constituencyMatch = suggestion.matches?.find(m => m.key === 'constituency_name');
    const locationMatch = suggestion.matches?.find(m => m.key === 'office_location');

    return {
      primary: constituencyMatch ? 
        highlightMatches(suggestion.constituency_name, [constituencyMatch]) : 
        suggestion.constituency_name,
      secondary: countyMatch ? 
        highlightMatches(suggestion.county, [countyMatch]) : 
        suggestion.county,
      tertiary: locationMatch ? 
        highlightMatches(suggestion.office_location, [locationMatch]) : 
        suggestion.office_location
    };
  };

  return (
    <div className={`relative ${className}`}>
      <div className={`search-container transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-ios-gray-800/95 border-ios-gray-600 shadow-ios-high-dark backdrop-blur-2xl'
          : 'bg-white/95 border-ios-gray-200 shadow-ios-high backdrop-blur-2xl'
      } border rounded-2xl`}>
        <div className="flex items-center space-x-3">
          <div className="pl-2">
            <Search className={`w-5 h-5 transition-colors duration-300 ${
              theme === 'dark' ? 'text-ios-gray-300' : 'text-ios-gray-500'
            }`} />
          </div>
          
          <div className="flex-1 relative min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className={`w-full bg-transparent border-none outline-none placeholder:text-muted-foreground text-base py-2 px-1 pr-16 transition-colors duration-300 ${
                theme === 'dark' ? 'text-white placeholder-ios-gray-400' : 'text-ios-gray-900 placeholder-ios-gray-500'
              }`}
              style={{ textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}
              aria-label={placeholder}
            />

            <div className="absolute inset-y-0 right-2 flex items-center space-x-2">
              {value && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  onClick={handleClear}
                  className={`flex items-center justify-center p-1 rounded-full transition-all duration-200 ${
                    theme === 'dark'
                      ? 'hover:bg-ios-gray-700/80 text-ios-gray-300 hover:text-white'
                      : 'hover:bg-ios-gray-100 text-ios-gray-500 hover:text-ios-gray-700'
                  }`}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleUseCurrentLocation}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  theme === 'dark'
                    ? 'hover:bg-ios-gray-700/80 text-ios-blue-400 hover:text-ios-blue-300'
                    : 'hover:bg-ios-gray-100 text-ios-blue hover:text-ios-blue-600'
                }`}
                title="Use current location"
              >
                <MapPin className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (suggestions.length > 0 || isLoading) && (
            <motion.div
              className={`absolute top-full left-0 right-0 mt-2 border rounded-2xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto transition-all duration-300 ${
                theme === 'dark'
                  ? 'bg-ios-gray-800/95 backdrop-blur-2xl border-ios-gray-600 shadow-ios-high-dark'
                  : 'bg-white/95 backdrop-blur-2xl border-ios-gray-200 shadow-ios-high'
              }`}
              style={{ zIndex: 1001 }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <div className={`p-4 text-center transition-colors duration-300 ${
                  theme === 'dark' ? 'text-ios-gray-300' : 'text-ios-gray-600'
                }`}>
                  <div className={`inline-block animate-spin rounded-full h-4 w-4 border-b-2 ${
                    theme === 'dark' ? 'border-ios-blue-400' : 'border-ios-blue'
                  }`}></div>
                  <span className="ml-2">Searching...</span>
                </div>
              ) : (
                <>
                  {suggestions.map((suggestion, index) => {
                    const display = getSuggestionDisplay(suggestion);
                    return (
                      <motion.div
                        key={suggestion.id || index}
                        className={`border-b transition-all duration-300 ${
                          theme === 'dark' 
                            ? 'border-ios-gray-700 hover:border-ios-gray-500' 
                            : 'border-ios-gray-200 hover:border-ios-gray-300'
                        } last:border-b-0`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <button
                          onClick={() => handleSuggestionSelect(suggestion)}
                          className={`w-full text-left p-4 transition-all duration-200 ${
                            theme === 'dark'
                              ? 'hover:bg-ios-gray-700/80 text-white'
                              : 'hover:bg-ios-gray-50/90 text-ios-gray-900'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                              suggestion.type === 'office' 
                                ? theme === 'dark'
                                  ? 'bg-ios-blue/40 text-ios-blue-200 shadow-lg'
                                  : 'bg-ios-blue/20 text-ios-blue shadow-md'
                                : theme === 'dark'
                                  ? 'bg-green-500/40 text-green-200 shadow-lg'
                                  : 'bg-green-500/20 text-green-600 shadow-md'
                            }`}>
                              {suggestion.type === 'office' ? (
                                <MapPin className="w-4 h-4" />
                              ) : (
                                <Search className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-medium text-sm truncate transition-colors duration-300 ${
                                theme === 'dark' ? 'text-white' : 'text-ios-gray-900'
                              }`}>
                                {display.primary}
                              </div>
                              <div className={`text-xs truncate transition-colors duration-300 ${
                                theme === 'dark' ? 'text-ios-gray-300' : 'text-ios-gray-600'
                              }`}>
                                {display.secondary}
                              </div>
                              {display.tertiary && (
                                <div className={`text-xs truncate mt-1 transition-colors duration-300 ${
                                  theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-500'
                                }`}>
                                  {display.tertiary}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                  
                  <div className={`p-3 border-t transition-all duration-300 ${
                    theme === 'dark' 
                      ? 'border-ios-gray-700 bg-ios-gray-800/80' 
                      : 'border-ios-gray-200 bg-ios-gray-50/90'
                  }`}>
                    <div className={`text-xs text-center transition-colors duration-300 ${
                      theme === 'dark' ? 'text-ios-gray-400' : 'text-ios-gray-500'
                    }`}>
                      Press <kbd className={`px-2 py-1 border rounded text-xs font-mono transition-all duration-300 ${
                        theme === 'dark'
                          ? 'bg-ios-gray-700 border-ios-gray-600 text-ios-gray-300 shadow-lg'
                          : 'bg-white border-ios-gray-300 text-ios-gray-600 shadow-md'
                      }`}>Enter</kbd> to see all results
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SearchBar;