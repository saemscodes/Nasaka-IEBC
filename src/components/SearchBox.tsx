import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, Sparkles, Zap } from 'lucide-react';

interface SearchBoxProps<T> {
  placeholder: string;
  onSearch: (query: string) => Promise<T[]>;
  onSelect: (item: T) => void;
  getDisplayText: (item: T) => string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholderRotation?: string[]; // New: Custom rotating placeholders
}

function SearchBox<T>({ 
  placeholder, 
  onSearch, 
  onSelect, 
  getDisplayText, 
  className = "",
  value,
  onChange,
  disabled = false,
  placeholderRotation = []
}: SearchBoxProps<T>) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholder);
  const [searchIntensity, setSearchIntensity] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const lastSearchRef = useRef<string | null>(null);
  const isUserSelectionRef = useRef<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const placeholderIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Rotating placeholder animation
  useEffect(() => {
    if (placeholderRotation.length > 0 && !isFocused && !query) {
      let index = 0;
      placeholderIntervalRef.current = setInterval(() => {
        setCurrentPlaceholder(placeholderRotation[index % placeholderRotation.length]);
        index++;
      }, 2000);
    } else {
      setCurrentPlaceholder(placeholder);
    }

    return () => {
      if (placeholderIntervalRef.current) {
        clearInterval(placeholderIntervalRef.current);
      }
    };
  }, [placeholderRotation, isFocused, query, placeholder]);

  // Search intensity animation (pulses during loading)
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setSearchIntensity(prev => (prev + 1) % 3);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setSearchIntensity(0);
    }
  }, [isLoading]);

  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
      isUserSelectionRef.current = false;
    }
  }, [value]);

  useEffect(() => {
    const performSearch = async () => {
      if (isUserSelectionRef.current) {
        isUserSelectionRef.current = false;
        return;
      }

      if (query.length < 2 || disabled || query === lastSearchRef.current) {
        if (query.length < 2) {
          setResults([]);
          setIsOpen(false);
        }
        return;
      }

      const currentQuery = query;
      lastSearchRef.current = query;
      setIsLoading(true);
      
      try {
        const searchResults = await onSearch(query);
        
        if (currentQuery === query && currentQuery === lastSearchRef.current) {
          setResults(searchResults);
          setIsOpen(searchResults.length > 0);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Search error:', error);
        if (currentQuery === query) {
          setResults([]);
          setIsOpen(false);
        }
      } finally {
        if (currentQuery === query) {
          setIsLoading(false);
        }
      }
    };

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(performSearch, 300);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, onSearch, disabled]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const newValue = e.target.value;
    setQuery(newValue);
    onChange?.(newValue);
    
    isUserSelectionRef.current = false;
    if (newValue !== lastSearchRef.current) {
      lastSearchRef.current = null;
    }
  };

  const handleSelect = (item: T) => {
    if (disabled) return;
    
    onSelect(item);
    const displayText = getDisplayText(item);
    setQuery(displayText);
    onChange?.(displayText);
    setIsOpen(false);
    setSelectedIndex(-1);
    
    isUserSelectionRef.current = true;
    lastSearchRef.current = displayText;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0 || disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleFocus = () => {
    if (!disabled) {
      setIsFocused(true);
      if (query.length >= 2 && results.length > 0) {
        setIsOpen(true);
      }
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    setIsFocused(false);
    setTimeout(() => {
      if (!e.relatedTarget || !resultsRef.current?.contains(e.relatedTarget as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }, 150);
  };

  return (
    <div className="relative w-full">
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        
        @keyframes bounce-in {
          0% { transform: scale(0.8) translateY(10px); opacity: 0; }
          60% { transform: scale(1.05) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0px); opacity: 1; }
        }
        
        @keyframes search-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        .search-container {
          position: relative;
          overflow: hidden;
        }
        
        .search-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.1), transparent);
          animation: shimmer 2s infinite;
          pointer-events: none;
          z-index: 1;
        }
        
        .search-input {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 2px solid #bbf7d0;
          transition: all 0.3s ease;
          position: relative;
          z-index: 2;
        }
        
        .search-input:focus {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border-color: #22c55e;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1), 0 4px 20px rgba(34, 197, 94, 0.15);
          animation: pulse-glow 2s infinite;
        }
        
        .search-input:hover:not(:focus) {
          border-color: #86efac;
          box-shadow: 0 2px 10px rgba(34, 197, 94, 0.1);
        }
        
        .search-input::placeholder {
          color: #059669;
          opacity: 0.7;
          transition: all 0.3s ease;
        }
        
        .search-input:focus::placeholder {
          color: #047857;
          opacity: 0.5;
        }
        
        .loading-text {
          animation: search-pulse 1s infinite;
        }
        
        .floating-icon {
          animation: float 3s ease-in-out infinite;
        }
        
        .bounce-in {
          animation: bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .result-item {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(0);
        }
        
        .result-item:hover {
          transform: translateX(4px);
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.15);
        }
        
        .result-item.selected {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: white;
          transform: translateX(6px);
          box-shadow: 0 6px 20px rgba(34, 197, 94, 0.3);
        }
        
        .dropdown-card {
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #bbf7d0;
          box-shadow: 0 10px 40px rgba(34, 197, 94, 0.15);
          animation: bounce-in 0.3s ease-out;
        }
        
        .search-icon-container {
          transition: all 0.3s ease;
        }
        
        .search-icon {
          transition: all 0.3s ease;
          color: #059669;
        }
        
        .search-icon:hover {
          color: #047857;
          transform: scale(1.1);
        }
        
        .intensity-0 { opacity: 0.6; }
        .intensity-1 { opacity: 0.8; }
        .intensity-2 { opacity: 1; transform: scale(1.05); }
      `}</style>

      <div className="search-container relative">
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder={currentPlaceholder}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            className={`search-input pr-20 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          />
          
          {/* Animated loading state */}
          {isLoading && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <div className="flex items-center space-x-2">
                <Loader2 className={`w-4 h-4 animate-spin text-green-600 intensity-${searchIntensity}`} />
                <Sparkles className="w-3 h-3 text-green-500 floating-icon" />
                <span className="loading-text text-xs text-green-600 font-medium whitespace-nowrap">
                  Searching...
                </span>
              </div>
            </div>
          )}
          
          {/* Search icon with hover effects */}
          {!isLoading && (
            <div className="search-icon-container absolute inset-y-0 right-3 flex items-center">
              <div className="flex items-center space-x-1">
                <Search className="search-icon w-4 h-4" />
                {query.length >= 2 && (
                  <Zap className="w-3 h-3 text-green-500 floating-icon" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Animated dropdown */}
        {isOpen && !disabled && (
          <Card className="dropdown-card absolute top-full left-0 right-0 z-50 mt-2 max-h-60 overflow-auto">
            <CardContent className="p-0" ref={resultsRef}>
              {isLoading ? (
                <div className="px-4 py-4 flex items-center justify-center text-sm text-green-700">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                    <Sparkles className="w-4 h-4 text-green-500 floating-icon" />
                    <span className="loading-text font-medium">Finding the perfect match...</span>
                    <Sparkles className="w-4 h-4 text-green-500 floating-icon" style={{animationDelay: '0.5s'}} />
                  </div>
                </div>
              ) : results.length > 0 ? (
                results.map((item, index) => (
                  <div
                    key={index}
                    className={`result-item px-4 py-3 cursor-pointer border-b border-green-100 last:border-b-0 ${
                      index === selectedIndex ? 'selected' : ''
                    }`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    style={{animationDelay: `${index * 0.05}s`}}
                  >
                    <div className="flex items-center space-x-2">
                      <Search className="w-3 h-3 text-green-500" />
                      <span>{getDisplayText(item)}</span>
                    </div>
                  </div>
                ))
              ) : query.length >= 2 ? (
                <div className="bounce-in px-4 py-6 text-center text-sm text-green-600">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="floating-icon">
                      <Search className="w-6 h-6 text-green-400" />
                    </div>
                    <div className="font-medium">No results found</div>
                    <div className="text-xs text-green-500">Try a different search term</div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default SearchBox;
