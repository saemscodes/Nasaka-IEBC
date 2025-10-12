// src/components/IEBCOffice/SearchBar.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import Fuse from 'fuse.js';

const SearchBar = ({ 
  value, 
  onChange, 
  onFocus, 
  onSearch, 
  onLocationSearch,
  placeholder = "Search IEBC offices..." 
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
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

  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (newValue.trim().length >= 2) {
      setIsLoading(true);
      setShowSuggestions(true);
      
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(newValue);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
    }
  }, [onChange]);

  const performSearch = (query) => {
    if (!fuse) {
      setIsLoading(false);
      return;
    }

    const results = fuse.search(query).slice(0, 8);
    const formattedResults = results.map(result => ({
      ...result.item,
      matches: result.matches,
      score: result.score
    }));

    setSuggestions(formattedResults);
    setIsLoading(false);
  };

  const handleSuggestionSelect = (office) => {
    onChange(office.constituency_name || office.county || 'IEBC Office');
    setShowSuggestions(false);
    setSuggestions([]);
    onSearch(office);
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
    onFocus?.();
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setShowSuggestions(false);
      
      if (value.trim()) {
        // Perform search with current input
        const searchResults = fuse?.search(value.trim()).slice(0, 20) || [];
        const formattedResults = searchResults.map(result => result.item);
        
        if (formattedResults.length > 0) {
          // If we have results, trigger search with first result
          onSearch(formattedResults[0]);
        } else {
          // If no results, trigger search with query
          onSearch({ searchQuery: value.trim() });
        }
      }
    }
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
    <div className="relative">
      <div className="search-container">
        <div className="flex items-center space-x-3">
          {/* Search Icon */}
          <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          
          {/* Search Input */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-base"
          />
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex-shrink-0">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          
          {/* Location Button */}
          <button
            onClick={onLocationSearch}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-muted hover:bg-accent transition-colors"
            aria-label="Use my location"
          >
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search Suggestions */}
      <AnimatePresence>
        {showSuggestions && (suggestions.length > 0 || isLoading) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="search-suggestions"
          >
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </div>
              </div>
            ) : (
              <>
                {suggestions.map((office, index) => {
                  const display = getSuggestionDisplay(office);
                  return (
                    <div
                      key={`${office.id}-${index}`}
                      className="search-suggestion-item"
                      onClick={() => handleSuggestionSelect(office)}
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">
                          {display.primary}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {display.secondary}
                        </div>
                        {display.tertiary && (
                          <div className="text-xs text-muted-foreground truncate">
                            {display.tertiary}
                          </div>
                        )}
                      </div>
                    </div>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar;
