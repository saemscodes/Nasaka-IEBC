// src/components/IEBCOffice/SearchBar.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, MapPin, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Fuse from 'fuse.js';

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
    // Don't trigger panel immediately, just focus the input
    setIsExpanded(true);
    // Don't call onFocus here - let Enter trigger the full search
  };

  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.type === 'office' && onSearch) {
      onSearch(suggestion);
    } else if (suggestion.type === 'search_query' && onSearch) {
      // Trigger broader search
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
        // Trigger full search and open panel on Enter
        onSearch({ searchQuery: value.trim() });
        if (onFocus) onFocus(); // Now trigger the panel
      }
      setIsExpanded(false);
    }
  };

  // Highlight matches in search results
  const highlightMatches = (text, matches) => {
    if (!matches || !text) return text;

    const matchIndices = matches
      .flatMap(match => match.indices)
      .sort((a, b) => a[0] - b[0]);

    if (matchIndices.length === 0) return text;

    let result = [];
    let lastIndex = 0;

    matchIndices.forEach(([start, end]) => {
      // Add text before match
      if (start > lastIndex) {
        result.push(text.slice(lastIndex, start));
      }

      // Add highlighted match
      result.push(
        <span key={start} className="bg-yellow-200 text-yellow-900 px-1 rounded">
          {text.slice(start, end + 1)}
        </span>
      );

      lastIndex = end + 1;
    });

    // Add remaining text
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
      <div className="search-container bg-background/95 dark:bg-card/95">
        <div className="flex items-center space-x-3">
          {/* Search Icon */}
          <div className="pl-2">
            <Search className="w-5 h-5 text-muted-foreground" />
          </div>
          
          {/* Search Input */}
          <div className="flex-1 relative min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-base py-2 px-1 pr-10"
              style={{ textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}
              aria-label={placeholder}
            />

            {/* right-side controls container (clear + location) */}
            <div className="absolute inset-y-0 right-2 flex items-center space-x-2">
              {/* Clear Button */}
              {value && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  onClick={handleClear}
                  className="flex items-center justify-center p-1 rounded-full hover:bg-accent transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground block" />
                </motion.button>
              )}

              {/* Location Button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleUseCurrentLocation}
                className="p-2 rounded-xl hover:bg-accent transition-colors"
                title="Use current location"
              >
                <MapPin className="w-5 h-5 text-primary" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Search Suggestions - Fixed z-index to match search bar */}
        <AnimatePresence>
          {isExpanded && (suggestions.length > 0 || isLoading) && (
            <motion.div
              className="absolute top-full left-0 right-0 mt-2 bg-background/98 dark:bg-card/98 backdrop-blur-xl border border-border rounded-2xl shadow-lg overflow-hidden max-h-96 overflow-y-auto"
              style={{ zIndex: 1001 }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="ml-2">Searching...</span>
                </div>
              ) : (
                <>
                  {suggestions.map((suggestion, index) => {
                    const display = getSuggestionDisplay(suggestion);
                    return (
                      <motion.div
                        key={suggestion.id || index}
                        className="border-b border-border last:border-b-0"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <button
                          onClick={() => handleSuggestionSelect(suggestion)}
                          className="w-full text-left p-4 hover:bg-accent transition-colors"
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              suggestion.type === 'office' 
                                ? 'bg-primary/20 text-primary dark:bg-primary/30' 
                                : 'bg-green-500/20 text-green-600 dark:bg-green-500/30 dark:text-green-400'
                            }`}>
                              {suggestion.type === 'office' ? (
                                <MapPin className="w-4 h-4" />
                              ) : (
                                <Search className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground text-sm truncate">
                                {display.primary}
                              </div>
                              <div className="text-muted-foreground text-xs truncate">
                                {display.secondary}
                              </div>
                              {display.tertiary && (
                                <div className="text-muted-foreground text-xs truncate mt-1">
                                  {display.tertiary}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                  
                  {/* Search hint */}
                  <div className="p-3 border-t border-border bg-muted/30">
                    <div className="text-xs text-muted-foreground text-center">
                      Press <kbd className="px-1 py-0.5 bg-background/80 dark:bg-card/80 border border-border rounded text-xs">Enter</kbd> to see all results
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
