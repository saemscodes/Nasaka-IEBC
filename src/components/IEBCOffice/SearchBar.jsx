// src/components/IEBCOffice/SearchBar.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, MapPin, Loader2 } from 'lucide-react';
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

  // Load all offices for search indexing
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

  const performSearch = useCallback(async (searchTerm) => {
    if (!searchTerm.trim() || !fuse) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = fuse.search(searchTerm).slice(0, 8);
      const formattedResults = results.map(result => ({
        ...result.item,
        matches: result.matches,
        score: result.score
      }));

      setSuggestions(formattedResults);
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

    if (value.trim() && fuse) {
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
  }, [value, performSearch, fuse]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (newValue.trim()) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
      setSuggestions([]);
    }
  };

  const handleInputFocus = () => {
    setIsExpanded(true);
    if (value.trim() && fuse) {
      performSearch(value);
    }
    if (onFocus) onFocus();
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setIsExpanded(false);
    }, 200);
  };

  const handleSuggestionSelect = (office) => {
    onChange(office.constituency_name || office.county || 'IEBC Office');
    setIsExpanded(false);
    setSuggestions([]);
    if (onSearch) {
      onSearch(office);
    }
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsExpanded(false);
      
      if (value.trim() && onSearch) {
        // Perform search with current input
        if (fuse) {
          const searchResults = fuse.search(value.trim()).slice(0, 20) || [];
          const formattedResults = searchResults.map(result => result.item);
          
          if (formattedResults.length > 0) {
            // If we have results, trigger search with first result
            onSearch(formattedResults[0]);
          } else {
            // If no results, trigger search with query
            onSearch({ searchQuery: value.trim() });
          }
        } else {
          onSearch({ searchQuery: value.trim() });
        }
      }
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

  const getSuggestionDisplay = (office) => {
    const mainMatch = office.matches?.[0];
    const countyMatch = office.matches?.find(m => m.key === 'county');
    const constituencyMatch = office.matches?.find(m => m.key === 'constituency_name');
    const locationMatch = office.matches?.find(m => m.key === 'office_location');

    return {
      primary: constituencyMatch ? 
        highlightMatches(office.constituency_name, [constituencyMatch]) : 
        office.constituency_name,
      secondary: countyMatch ? 
        highlightMatches(office.county, [countyMatch]) : 
        office.county,
      tertiary: locationMatch ? 
        highlightMatches(office.office_location, [locationMatch]) : 
        office.office_location
    };
  };

  return (
    <div className={`relative ${className}`}>
      <div className="search-container">
        <div className="flex items-center space-x-3">
          {/* Search Icon */}
          <div className="pl-2">
            <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </div>
          
          {/* Search Input */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-base py-2 px-1"
            />
            
            {/* Clear Button */}
            {value && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={handleClear}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            )}
          </div>

          {/* Location Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleUseCurrentLocation}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
            title="Use current location"
          >
            <MapPin className="w-5 h-5 text-primary" />
          </motion.button>
        </div>
      </div>

      {/* Search Suggestions - Fixed positioning below search bar */}
      <AnimatePresence>
        {isExpanded && (suggestions.length > 0 || isLoading) && (
          <motion.div
            className="search-suggestions-container"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="search-suggestions">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </div>
                </div>
              ) : (
                <>
                  {suggestions.map((office, index) => {
                    const display = getSuggestionDisplay(office);
                    return (
                      <motion.div
                        key={office.id || index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <button
                          onClick={() => handleSuggestionSelect(office)}
                          className="search-suggestion-item w-full text-left"
                        >
                          <div className="space-y-1">
                            <div className="font-medium text-foreground text-sm">
                              {display.primary}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {display.secondary}
                            </div>
                            {display.tertiary && (
                              <div className="text-muted-foreground text-xs truncate">
                                {display.tertiary}
                              </div>
                            )}
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                  
                  {/* Search hint */}
                  <div className="p-3 border-t border-border">
                    <div className="text-xs text-muted-foreground text-center">
                      Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> to see all results
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar;
