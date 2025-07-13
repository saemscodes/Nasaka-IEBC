// components/SearchBox.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";

interface SearchBoxProps {
  placeholder: string;
  onSearch: (query: string) => Promise<any[]>;
  onSelect: (item: any) => void;
  getDisplayText: (item: any) => string;
  className?: string;
  disabled?: boolean;
}

const SearchBox = ({
  placeholder,
  onSearch,
  onSelect,
  getDisplayText,
  className = "",
  disabled = false
}: SearchBoxProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <b>{text.substring(index, index + query.length)}</b>
        {text.substring(index + query.length)}
      </>
    );
  };

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await onSearch(query);
        setResults(data);
        setShowResults(true);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, onSearch]);

  const handleSelect = (item: any) => {
    setQuery(getDisplayText(item));
    onSelect(item);
    setShowResults(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="pr-10"
          disabled={disabled}
        />
        {isLoading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="py-1 max-h-60 overflow-auto">
            {results.map((item, index) => (
              <div
                key={index}
                className="px-4 py-2 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSelect(item)}
              >
                {highlightMatch(getDisplayText(item), query)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBox;
