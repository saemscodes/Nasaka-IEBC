
import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import AnimatedSearchIcon from './AnimatedSearchIcon';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  const lastSearchRef = useRef<string | null>(null);
  const isUserSelectionRef = useRef<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          className={`w-full pr-16 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        />
        
        {isLoading && (
          <div className="absolute inset-y-0 right-3 flex items-center">
            <Loader2 className="w-4 h-4 animate-spin text-green-500" />
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Searching...
            </span>
          </div>
        )}
        
        {!isLoading && (
          <div className="absolute inset-y-0 right-3 flex items-center">
            <AnimatedSearchIcon 
              isLoading={isLoading}
              isActive={inputRef.current === document.activeElement}
              className="w-4 h-4 text-green-600 dark:text-green-400"
            />
          </div>
        )}
      </div>

      {isOpen && !disabled && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
          <CardContent className="p-0" ref={resultsRef}>
            {isLoading ? (
              <div className="px-4 py-3 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span>Searching for results...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((item, index) => (
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
              ))
            ) : query.length >= 2 ? (
              <div className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                <AnimatedSearchIcon className="w-5 h-5 mx-auto mb-2 opacity-50" />
                <div>No results found for "{query}"</div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SearchBox;
