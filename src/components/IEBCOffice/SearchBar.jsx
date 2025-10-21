import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Filter } from 'lucide-react';
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

  // IEBC Icon Component
  const IEBCIcon = ({ className = "w-10 h-10" }) => (
    <svg
      version="1.0"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 1080.000000 1080.000000"
      preserveAspectRatio="xMidYMid meet"
      fill="currentColor"
    >
      <g transform="translate(0.000000,1080.000000) scale(0.100000,-0.100000)" stroke="none">
        <path d="M5135 9223 c-559 -49 -1092 -260 -1555 -616 -117 -90 -384 -351 -477 -467 -290 -360 -500 -803 -593 -1250 -72 -351 -79 -741 -19 -1089 104 -604 429 -1261 949 -1922 103 -132 1951 -2309 1959 -2308 7 0 1719 2051 1854 2219 560 701 899 1332 1026 1905 50 227 56 288 56 580 0 294 -7 370 -52 595 -254 1267 -1318 2228 -2601 2350 -98 9 -453 11 -547 3z m575 -638 c250 -35 478 -104 692 -208 249 -122 436 -255 633 -452 356 -355 580 -799 657 -1299 31 -204 31 -519 0 -701 -86 -502 -308 -938 -653 -1284 -439 -438 -1025 -681 -1644 -681 -864 0 -1643 471 -2055 1243 -176 330 -261 685 -261 1092 0 476 126 888 394 1290 116 173 289 364 453 497 427 348 970 536 1514 523 85 -2 207 -11 270 -20z"/>
        <path d="M5250 7760 c-597 -83 -1055 -488 -1213 -1070 -30 -112 -31 -122 -31 -330 -1 -172 3 -232 17 -300 125 -583 579 -1025 1157 -1125 126 -22 354 -22 485 0 575 96 1033 540 1161 1125 15 67 19 127 19 280 0 209 -10 279 -61 443 l-26 80 -119 -119 -120 -120 16 -88 c69 -397 -86 -810 -399 -1065 -134 -109 -267 -175 -450 -224 -69 -18 -108 -21 -266 -21 -159 0 -196 3 -265 21 -164 45 -307 116 -427 212 -214 170 -351 396 -409 673 -30 148 -23 372 16 503 36 121 74 211 125 292 206 327 541 524 920 540 296 12 569 -85 790 -283 l63 -56 106 107 106 106 -65 60 c-181 166 -432 292 -685 344 -94 19 -352 28 -445 15z"/>
        <path d="M6780 7494 c-30 -8 -78 -29 -107 -46 -32 -20 -258 -238 -614 -594 l-563 -564 -196 195 c-170 169 -206 199 -266 227 -66 31 -75 33 -184 33 -105 0 -120 -2 -170 -27 -30 -15 -71 -41 -90 -57 l-35 -30 450 -450 c442 -443 451 -451 490 -451 39 0 49 9 867 827 l827 827 -20 22 c-31 33 -127 80 -187 93 -70 15 -135 13 -202 -5z"/>
      </g>
    </svg>
  );

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
            ? 'bg-amber-400/90 text-amber-900 shadow-lg' 
            : 'bg-yellow-400/90 text-yellow-900 shadow-md'
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
      {/* Enhanced Backdrop Overlay */}
      <AnimatePresence>
        {isExpanded && (suggestions.length > 0 || isLoading) && (
          <motion.div
            className="fixed inset-0 z-1000"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              background: theme === 'dark' 
                ? 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.6) 100%)'
                : 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.6) 100%)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>

      <div className={`search-container transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-ios-dark-surface/95 border-ios-dark-border shadow-ios-high-dark backdrop-blur-2xl'
          : 'bg-white/95 border-ios-light-border shadow-ios-high backdrop-blur-2xl'
      } border rounded-2xl`}>
        <div className="flex items-center space-x-3">
          <div className="pl-4">
            <Search className={`w-5 h-5 transition-colors duration-300 ${
              theme === 'dark' ? 'text-ios-dark-text-secondary' : 'text-ios-light-text-secondary'
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
                theme === 'dark' 
                  ? 'text-ios-dark-text-primary placeholder-ios-dark-text-tertiary' 
                  : 'text-ios-light-text-primary placeholder-ios-light-text-tertiary'
              }`}
              style={{ 
                textOverflow: "ellipsis", 
                whiteSpace: "nowrap", 
                overflow: "hidden",
                color: theme === 'dark' ? '#FFFFFF' : '#1C1C1E',
                caretColor: theme === 'dark' ? '#FFFFFF' : '#1C1C1E'
              }}
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
                      ? 'hover:bg-ios-dark-surface-hover text-ios-dark-text-secondary hover:text-ios-dark-text-primary'
                      : 'hover:bg-ios-light-surface-hover text-ios-light-text-secondary hover:text-ios-light-text-primary'
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
                    ? 'hover:bg-ios-dark-surface-hover text-ios-blue-dark hover:text-ios-blue-light'
                    : 'hover:bg-ios-light-surface-hover text-ios-blue hover:text-ios-blue-dark'
                }`}
                title="Use current location"
              >
                <IEBCIcon className="w-14 h-14" />
              </motion.button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (suggestions.length > 0 || isLoading) && (
            <motion.div
              className={`absolute top-full left-0 right-0 mt-2 border rounded-2xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto transition-all duration-300 ${
                theme === 'dark'
                  ? 'bg-ios-dark-surface/95 backdrop-blur-3xl border-ios-dark-border shadow-ios-high-dark'
                  : 'bg-white/98 backdrop-blur-3xl border-ios-light-border shadow-ios-high'
              }`}
              style={{ zIndex: 1001 }}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ 
                duration: 0.2,
                type: "spring",
                stiffness: 500,
                damping: 30
              }}
            >
              {isLoading ? (
                <div className={`p-6 text-center transition-colors duration-300 ${
                  theme === 'dark' ? 'text-ios-dark-text-secondary' : 'text-ios-light-text-secondary'
                }`}>
                  <div className={`inline-block animate-spin rounded-full h-6 w-6 border-b-2 ${
                    theme === 'dark' ? 'border-ios-blue-dark' : 'border-ios-blue'
                  }`}></div>
                  <span className="ml-3 text-sm font-medium">Searching IEBC offices...</span>
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
                            ? 'border-ios-dark-border hover:border-ios-dark-border-hover' 
                            : 'border-ios-light-border hover:border-ios-light-border-hover'
                        } last:border-b-0`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ 
                          delay: index * 0.03,
                          type: "spring",
                          stiffness: 400,
                          damping: 25
                        }}
                      >
                        <button
                          onClick={() => handleSuggestionSelect(suggestion)}
                          className={`w-full text-left p-4 transition-all duration-200 ${
                            theme === 'dark'
                              ? 'hover:bg-ios-dark-surface-hover text-ios-dark-text-primary'
                              : 'hover:bg-ios-light-surface-hover text-ios-light-text-primary'
                          }`}
                        >
                          <div className="flex items-start space-x-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                              suggestion.type === 'office' 
                                ? theme === 'dark'
                                  ? 'bg-ios-blue-dark/30 text-ios-blue-light shadow-lg'
                                  : 'bg-ios-blue/20 text-ios-blue-dark shadow-md'
                                : theme === 'dark'
                                  ? 'bg-green-500/30 text-green-300 shadow-lg'
                                  : 'bg-green-500/20 text-green-600 shadow-md'
                            }`}>
                              {suggestion.type === 'office' ? (
                                <IEBCIcon className="w-5 h-5" />
                              ) : (
                                <Search className="w-5 h-5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold text-base truncate transition-colors duration-300 ${
                                theme === 'dark' ? 'text-ios-dark-text-primary' : 'text-ios-light-text-primary'
                              }`}>
                                {display.primary}
                              </div>
                              <div className={`text-sm truncate mt-1 transition-colors duration-300 ${
                                theme === 'dark' ? 'text-ios-dark-text-secondary' : 'text-ios-light-text-secondary'
                              }`}>
                                {display.secondary}
                              </div>
                              {display.tertiary && (
                                <div className={`text-xs truncate mt-2 transition-colors duration-300 ${
                                  theme === 'dark' ? 'text-ios-dark-text-tertiary' : 'text-ios-light-text-tertiary'
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
                  
                  <div className={`p-4 border-t transition-all duration-300 ${
                    theme === 'dark' 
                      ? 'border-ios-dark-border bg-ios-dark-surface/80' 
                      : 'border-ios-light-border bg-ios-light-surface/90'
                  }`}>
                    <div className={`text-sm text-center transition-colors duration-300 ${
                      theme === 'dark' ? 'text-ios-dark-text-tertiary' : 'text-ios-light-text-tertiary'
                    }`}>
                      Press <kbd className={`px-2 py-1 border rounded text-sm font-mono transition-all duration-300 ${
                        theme === 'dark'
                          ? 'bg-ios-dark-surface border-ios-dark-border text-ios-dark-text-secondary shadow-lg'
                          : 'bg-white border-ios-light-border text-ios-light-text-secondary shadow-md'
                      }`}>Enter</kbd> to see all IEBC office results
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Enhanced CSS for better glassmorphism and contrast */}
      <style jsx>{`
        /* Enhanced glassmorphism with better backdrop support */
        .backdrop-blur-3xl {
          backdrop-filter: blur(48px);
          -webkit-backdrop-filter: blur(48px);
        }

        /* Improved contrast for dark mode */
        .bg-ios-dark-surface {
          background-color: rgba(28, 28, 30, 0.95);
        }

        .bg-ios-dark-surface\\/95 {
          background-color: rgba(28, 28, 30, 0.95);
        }

        .bg-ios-dark-surface-hover {
          background-color: rgba(44, 44, 46, 0.8);
        }

        .border-ios-dark-border {
          border-color: rgba(84, 84, 88, 0.65);
        }

        .border-ios-dark-border-hover {
          border-color: rgba(120, 120, 128, 0.8);
        }

        .text-ios-dark-text-primary {
          color: rgba(255, 255, 255, 0.95);
        }

        .text-ios-dark-text-secondary {
          color: rgba(235, 235, 245, 0.8);
        }

        .text-ios-dark-text-tertiary {
          color: rgba(235, 235, 245, 0.6);
        }

        /* Improved contrast for light mode */
        .bg-ios-light-surface {
          background-color: rgba(255, 255, 255, 0.98);
        }

        .bg-ios-light-surface\\/98 {
          background-color: rgba(255, 255, 255, 0.98);
        }

        .bg-ios-light-surface-hover {
          background-color: rgba(242, 242, 247, 0.9);
        }

        .border-ios-light-border {
          border-color: rgba(216, 216, 220, 0.8);
        }

        .border-ios-light-border-hover {
          border-color: rgba(174, 174, 178, 0.8);
        }

        .text-ios-light-text-primary {
          color: rgba(28, 28, 30, 0.95);
        }

        .text-ios-light-text-secondary {
          color: rgba(60, 60, 67, 0.8);
        }

        .text-ios-light-text-tertiary {
          color: rgba(60, 60, 67, 0.6);
        }

        /* iOS blue colors */
        .text-ios-blue {
          color: rgba(0, 122, 255, 1);
        }

        .text-ios-blue-dark {
          color: rgba(10, 132, 255, 1);
        }

        .text-ios-blue-light {
          color: rgba(100, 210, 255, 1);
        }

        .bg-ios-blue {
          background-color: rgba(0, 122, 255, 1);
        }

        .bg-ios-blue-dark {
          background-color: rgba(10, 132, 255, 1);
        }

        .border-ios-blue-dark {
          border-color: rgba(10, 132, 255, 1);
        }

        /* Shadow enhancements */
        .shadow-ios-high {
          box-shadow: 
            0 24px 48px rgba(0, 0, 0, 0.18),
            0 12px 24px rgba(0, 0, 0, 0.12),
            0 0 0 1px rgba(0, 0, 0, 0.05);
        }

        .shadow-ios-high-dark {
          box-shadow: 
            0 24px 48px rgba(0, 0, 0, 0.35),
            0 12px 24px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(255, 255, 255, 0.1);
        }

        /* Force text color for dark mode compatibility */
        input {
          color: ${theme === 'dark' ? '#FFFFFF' : '#1C1C1E'} !important;
        }
        
        /* Force caret color only - no placeholder blinking */
        input {
          caret-color: ${theme === 'dark' ? '#FFFFFF' : '#1C1C1E'} !important;
        }
        
        /* Remove any animation from the input that might cause placeholder blinking */
        input {
          animation: none !important;
        }
        
        /* Ensure placeholder stays static and doesn't blink */
        input::placeholder {
          animation: none !important;
          opacity: 1 !important;
          color: ${theme === 'dark' ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)'} !important;
        }
        
        /* Browser-specific placeholder styling */
        input::-webkit-input-placeholder {
          animation: none !important;
          opacity: 1 !important;
        }
        
        input::-moz-placeholder {
          animation: none !important;
          opacity: 1 !important;
        }
        
        input:-ms-input-placeholder {
          animation: none !important;
          opacity: 1 !important;
        }
        
        input:-moz-placeholder {
          animation: none !important;
          opacity: 1 !important;
        }
        
        /* Enhanced caret visibility without affecting placeholder */
        input:focus {
          outline: none !important;
        }
        
        /* Remove any keyframe animations that might cause blinking */
        @keyframes none {
          /* Intentionally empty to override any existing animations */
        }

        /* Enhanced scrollbar for dropdown */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
          background: ${theme === 'dark' ? 'rgba(44, 44, 46, 0.4)' : 'rgba(242, 242, 247, 0.8)'};
          border-radius: 3px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? 'rgba(120, 120, 128, 0.6)' : 'rgba(174, 174, 178, 0.6)'};
          border-radius: 3px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'dark' ? 'rgba(150, 150, 160, 0.8)' : 'rgba(142, 142, 147, 0.8)'};
        }
      `}</style>
    </div>
  );
};

export default SearchBar;
