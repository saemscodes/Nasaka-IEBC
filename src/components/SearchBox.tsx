import React, { useState, useEffect, useRef } from 'react';
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

  // Icon definitions
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

  // Clear all timers
  const clearAllTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (cycleRef.current) clearTimeout(cycleRef.current);
    timerRef.current = null;
    cycleRef.current = null;
  };

  // Start animation cycle
  const startCycle = () => {
    clearAllTimers();
    
    if (!isIdleRef.current || isHoveredRef.current || isLoadingRef.current || isActiveRef.current) {
      return;
    }
    
    timerRef.current = setTimeout(() => {
      animateToNextIcon();
    }, 300);
  };

  // Animate to next icon in sequence
  const animateToNextIcon = () => {
    if (!isIdleRef.current || isHoveredRef.current || isLoadingRef.current || isActiveRef.current) {
      return;
    }
    
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
        
        // After full cycle completes, restart if still idle
        if (nextIndex === 0 && isIdleRef.current && !isLoadingRef.current && 
            !isActiveRef.current && !isHoveredRef.current) {
          startCycle();
        }
      }, delay);
    }, 350);
  };

  // Handle hover events
  const handleMouseEnter = () => {
    setIsHovered(true);
    clearAllTimers();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCurrentIcon(0);
    
    // Wait for state to update before checking again
    setTimeout(() => {
      if (isIdleRef.current && !isLoadingRef.current && 
          !isActiveRef.current && !isHoveredRef.current) {
        startCycle();
      }
    }, 200);
  };

  // Initialize animation cycle when conditions change
  useEffect(() => {
    if (isIdle && !isLoading && !isActive && !isHovered) {
      startCycle();
    } else {
      clearAllTimers();
    }
    
    return clearAllTimers;
  }, [isIdle, isLoading, isActive, isHovered]);

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

export default AnimatedSearchIcon;
