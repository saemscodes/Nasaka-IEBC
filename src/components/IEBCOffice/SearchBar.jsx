import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, MapPin, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const StickySearchBar = ({ 
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
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Enhanced search function with Supabase integration
  const performSearch = useCallback(async (searchTerm) => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Search across multiple fields in Supabase
      const { data: offices, error } = await supabase
        .from('iebc_offices')
        .select('*')
        .or(`county.ilike.%${searchTerm}%,constituency.ilike.%${searchTerm}%,constituency_name.ilike.%${searchTerm}%,office_location.ilike.%${searchTerm}%`)
        .eq('verified', true)
        .limit(10);

      if (error) throw error;

      const formattedSuggestions = (offices || []).map(office => ({
        id: office.id,
        name: office.constituency_name,
        subtitle: `${office.office_location}, ${office.county} County`,
        type: 'office',
        office: office
      }));

      // Add location-based suggestions
      if (searchTerm.length > 2) {
        formattedSuggestions.push({
          id: `search-${searchTerm}`,
          name: `Search for "${searchTerm}"`,
          subtitle: 'Find IEBC offices in this area',
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
  }, []);

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
    if (onFocus) onFocus();
  };

  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.type === 'office' && onSearch) {
      onSearch(suggestion.office);
    } else if (suggestion.type === 'search_query' && onSearch) {
      // Trigger broader search
      onChange(suggestion.query);
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

  return (
    <div className={`sticky-search-container ${className}`}>
      <motion.div
        className="glass-morphism rounded-2xl p-2 elevation-high"
        whileTap={{ scale: 0.995 }}
        initial={false}
        animate={{ 
          borderRadius: isExpanded ? '16px 16px 0 0' : '16px',
          transition: { duration: 0.2 }
        }}
      >
        <div className="flex items-center space-x-2">
          {/* Search Icon */}
          <div className="pl-2">
            <Search className="w-5 h-5 text-ios-gray-500" />
          </div>
          
          {/* Search Input */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder={placeholder}
              className="w-full bg-transparent border-none outline-none text-ios-gray-900 placeholder-ios-gray-500 text-base py-2 px-1"
            />
            
            {/* Clear Button */}
            {value && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={handleClear}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-ios-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-ios-gray-500" />
              </motion.button>
            )}
          </div>

          {/* Location Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleUseCurrentLocation}
            className="p-2 rounded-xl hover:bg-ios-gray-100 transition-colors"
            title="Use current location"
          >
            <MapPin className="w-5 h-5 text-ios-blue" />
          </motion.button>
        </div>

        {/* Search Suggestions */}
        <AnimatePresence>
          {isExpanded && (suggestions.length > 0 || isLoading) && (
            <motion.div
              className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md border-t border-ios-gray-200 max-h-80 overflow-y-auto"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <div className="p-4 text-center text-ios-gray-500">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-ios-blue"></div>
                  <span className="ml-2">Searching...</span>
                </div>
              ) : (
                <>
                  {suggestions.map((suggestion, index) => (
                    <motion.div
                      key={suggestion.id}
                      className="border-b border-ios-gray-100 last:border-b-0"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <button
                        onClick={() => handleSuggestionSelect(suggestion)}
                        className="w-full text-left p-4 hover:bg-ios-gray-50 transition-colors"
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            suggestion.type === 'office' 
                              ? 'bg-ios-blue/20 text-ios-blue' 
                              : 'bg-ios-green/20 text-ios-green'
                          }`}>
                            {suggestion.type === 'office' ? (
                              <MapPin className="w-4 h-4" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-ios-gray-900 text-sm truncate">
                              {suggestion.name}
                            </div>
                            <div className="text-ios-gray-500 text-xs truncate">
                              {suggestion.subtitle}
                            </div>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </>
              )}
              
              {/* Recent Searches/Filters */}
              <div className="p-3 border-t border-ios-gray-200 bg-ios-gray-50/50">
                <div className="flex items-center justify-between text-xs text-ios-gray-600">
                  <span>Quick filters:</span>
                  <button className="flex items-center space-x-1 text-ios-blue">
                    <Filter className="w-3 h-3" />
                    <span>Advanced</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default SearchBar;
