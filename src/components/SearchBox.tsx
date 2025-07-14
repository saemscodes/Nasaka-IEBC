import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SearchBoxProps<T> {
  placeholder: string;
  onSearch: (query: string) => Promise<T[]>;
  onSelect: (item: T) => void;
  getDisplayText: (item: T) => string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

function SearchBox<T>({ 
  placeholder, 
  onSearch, 
  onSelect, 
  getDisplayText, 
  className = "",
  value,
  onChange,
  disabled = false
}: SearchBoxProps<T>) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasUserSelected, setHasUserSelected] = useState(false); // NEW: Track if user has selected an item
  const [lastSearchQuery, setLastSearchQuery] = useState(''); // NEW: Track last search to prevent duplicates
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
      setHasUserSelected(false); // Reset selection state when value changes externally
    }
  }, [value]);

  useEffect(() => {
    const performSearch = async () => {
      // FIXED: Don't search if user has just selected an item
      if (hasUserSelected) {
        setHasUserSelected(false);
        return;
      }

      // FIXED: Don't search if query is too short, disabled, or same as last search
      if (query.length < 2 || disabled || query === lastSearchQuery) {
        if (query.length < 2) {
          setResults([]);
          setIsOpen(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        console.log('Searching for:', query);
        const searchResults = await onSearch(query);
        setResults(searchResults);
        setIsOpen(searchResults.length > 0);
        setSelectedIndex(-1);
        setLastSearchQuery(query); // NEW: Update last search query
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, onSearch, disabled, hasUserSelected, lastSearchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const newValue = e.target.value;
    setQuery(newValue);
    onChange?.(newValue);
    setHasUserSelected(false); // NEW: Reset selection state when user types
  };

  const handleSelect = (item: T) => {
    if (disabled) return;
    
    onSelect(item);
    const displayText = getDisplayText(item);
    setQuery(displayText);
    onChange?.(displayText);
    setIsOpen(false);
    setSelectedIndex(-1);
    setHasUserSelected(true); // NEW: Mark that user has selected an item
    setLastSearchQuery(displayText); // NEW: Update last search to prevent re-searching
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
    if (!disabled && query.length >= 2 && results.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    setTimeout(() => {
      if (!e.relatedTarget || !resultsRef.current?.contains(e.relatedTarget as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }, 150);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className={`w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        />
        {/* ENHANCED: Better loading visual with icon and positioning */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Searching...
            </span>
          </div>
        )}
        {/* ENHANCED: Search icon when not loading */}
        {!isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-600" />
          </div>
        )}
      </div>

      {/* ENHANCED: Better loading state in dropdown */}
      {isOpen && isLoading && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Searching for results...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ENHANCED: Show results only when not loading */}
      {isOpen && results.length > 0 && !disabled && !isLoading && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
          <CardContent className="p-0" ref={resultsRef}>
            {results.map((item, index) => (
              <div
                key={index}
                className={`px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                  index === selectedIndex 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {getDisplayText(item)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ENHANCED: Show "No results" message when search is complete but no results */}
      {isOpen && results.length === 0 && !isLoading && query.length >= 2 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
          <CardContent className="p-4">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <span className="text-sm">No results found for "{query}"</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SearchBox;
