import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AnimatedSearchIcon = ({ 
  className = "w-4 h-4 text-gray-400 dark:text-gray-600",
  isIdle = true,
  isActive = false,
  isLoading = false
}) => {
  const [currentIcon, setCurrentIcon] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cycleRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use refs to track latest state values
  const isIdleRef = useRef(isIdle);
  const isHoveredRef = useRef(isHovered);
  const isActiveRef = useRef(isActive);
  const isLoadingRef = useRef(isLoading);

  // Sync refs with current state
  useEffect(() => {
    isIdleRef.current = isIdle;
  }, [isIdle]);

  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Icon definitions with smooth morphing paths
  const iconPaths = [
    // Search icon (starting and ending)
    {
      name: 'search',
      paths: [
        { d: "M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0", strokeWidth: 2 },
        { d: "m21 21l-4.3-4.3", strokeWidth: 2 }
      ],
      viewBox: "0 0 24 24"
    },
    // Book icon
    {
      name: 'book',
      paths: [
        { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20", strokeWidth: 2 },
        { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z", strokeWidth: 2 }
      ],
      viewBox: "0 0 24 24"
    },
    // Document/Paper icon
    {
      name: 'document',
      paths: [
        { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", strokeWidth: 2 },
        { d: "M14 2v6h6", strokeWidth: 2 },
        { d: "M16 13H8", strokeWidth: 1.5 },
        { d: "M16 17H8", strokeWidth: 1.5 }
      ],
      viewBox: "0 0 24 24"
    },
    // Folder icon
    {
      name: 'folder',
      paths: [
        { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z", strokeWidth: 2 }
      ],
      viewBox: "0 0 24 24"
    }
  ];

  // Animation variants
  const containerVariants = {
    idle: { 
      scale: 1,
      rotate: 0,
      transition: { type: "spring", stiffness: 400, damping: 30 }
    },
    hover: { 
      scale: 1.05,
      rotate: 1,
      transition: { type: "spring", stiffness: 500, damping: 25 }
    },
    active: {
      scale: 1.1,
      rotate: 0,
      transition: { type: "spring", stiffness: 600, damping: 20 }
    },
    bounce: {
      scale: [1, 1.03, 1],
      transition: { 
        duration: 0.4,
        times: [0, 0.6, 1],
        type: "spring",
        stiffness: 600,
        damping: 35
      }
    }
  };

  const pathVariants = {
    hidden: { 
      pathLength: 0, 
      opacity: 0,
      transition: { duration: 0.2, ease: "easeOut" }
    },
    visible: { 
      pathLength: 1, 
      opacity: 1,
      transition: { 
        pathLength: { 
          duration: 0.8, 
          ease: [0.16, 1, 0.3, 1]
        },
        opacity: { duration: 0.3, ease: "easeOut" }
      }
    },
    morphing: {
      pathLength: [1, 0.2, 1],
      opacity: [1, 0.4, 1],
      transition: { 
        duration: 0.5,
        times: [0, 0.4, 1],
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  // Start animation cycle
  const startCycle = () => {
    if (!isIdleRef.current || isHoveredRef.current || isLoadingRef.current || isActiveRef.current) return;
    
    timerRef.current = setTimeout(() => {
      animateToNextIcon();
    }, 300);
  };

  // Animate to next icon in sequence
  const animateToNextIcon = () => {
    if (!isIdleRef.current || isHoveredRef.current || isLoadingRef.current || isActiveRef.current) return;
    
    setIsAnimating(true);
    
    const nextIndex = (currentIcon + 1) % iconPaths.length;
    const isReturningToSearch = nextIndex === 0 && currentIcon !== 0;
    
    setTimeout(() => {
      setCurrentIcon(nextIndex);
      setIsAnimating(false);
      
      let delay;
      if (isReturningToSearch) {
        delay = 2500;
      } else if (nextIndex === 0) {
        delay = 5000;
      } else {
        delay = 1500;
      }
      
      cycleRef.current = setTimeout(() => {
        animateToNextIcon();
      }, delay);
    }, 350);
  };

  // Handle hover events
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (cycleRef.current) clearTimeout(cycleRef.current);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCurrentIcon(0);
    setTimeout(startCycle, 100);
  };

  // Initialize animation cycle on mount and when dependencies change
  useEffect(() => {
    if (isIdle && !isLoading && !isActive) {
      startCycle();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (cycleRef.current) clearTimeout(cycleRef.current);
    }
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (cycleRef.current) clearTimeout(cycleRef.current);
    };
  }, [isIdle, isLoading, isActive]);

  const currentIconData = iconPaths[currentIcon];

  return (
    <motion.div
      className="flex items-center justify-center"
      variants={containerVariants}
      initial="idle"
      animate={
        isLoading ? "bounce" : 
        isActive ? "active" : 
        isHovered ? "hover" : 
        isAnimating ? "bounce" : "idle"
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <AnimatePresence mode="wait">
        <motion.svg
          key={currentIcon}
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox={currentIconData.viewBox}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ 
            duration: 0.35, 
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
        >
          {currentIconData.paths.map((path, index) => (
            <motion.path
              key={`${currentIcon}-${index}`}
              d={path.d}
              strokeWidth={path.strokeWidth}
              variants={pathVariants}
              initial="hidden"
              animate={isAnimating ? "morphing" : "visible"}
              style={{
                filter: isAnimating ? 'drop-shadow(0 0 2px rgba(99, 102, 241, 0.3))' : 'none'
              }}
            />
          ))}
        </motion.svg>
      </AnimatePresence>
    </motion.div>
  );
};

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

  const isInputFocused = inputRef.current === document.activeElement;
  const isIdle = !isLoading && !isInputFocused && !isOpen;

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
        
        <div className="absolute inset-y-0 right-3 flex items-center">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-green-500" />
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Searching...
              </span>
            </>
          ) : (
            <AnimatedSearchIcon 
              isIdle={isIdle}
              isActive={isInputFocused}
              isLoading={isLoading}
              className="w-4 h-4 text-green-600 dark:text-green-400"
            />
          )}
        </div>
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
                <AnimatedSearchIcon 
                  isIdle={false}
                  isActive={false}
                  isLoading={false}
                  className="w-5 h-5 mx-auto mb-2 opacity-50" 
                />
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
