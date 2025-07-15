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
  
  // Track if we're currently cycling through icons
  const isCyclingRef = useRef(false);

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

  // Clean up timers
  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (cycleRef.current) clearTimeout(cycleRef.current);
    timerRef.current = null;
    cycleRef.current = null;
    isCyclingRef.current = false;
  };

  // Start the icon cycling animation
  const startIconCycle = () => {
    clearTimers();
    
    if (!isIdle || isHovered || isLoading || isActive) {
      // Reset to search icon if not idle
      if (currentIcon !== 0) {
        setCurrentIcon(0);
      }
      return;
    }

    isCyclingRef.current = true;
    
    // Initial delay before starting cycle
    timerRef.current = setTimeout(() => {
      cycleToNextIcon();
    }, 1000); // Increased initial delay for better UX
  };

  // Cycle to the next icon in sequence
  const cycleToNextIcon = () => {
    if (!isIdle || isHovered || isLoading || isActive) {
      clearTimers();
      return;
    }

    setIsAnimating(true);
    
    // Calculate next icon index
    const nextIndex = (currentIcon + 1) % iconPaths.length;
    const isCompletingCycle = nextIndex === 0;

    // Morph to next icon after a short delay
    setTimeout(() => {
      setCurrentIcon(nextIndex);
      setIsAnimating(false);

      // Set different delays based on position in cycle
      const delay = isCompletingCycle ? 3000 : 1500; // Longer pause at end of cycle
      
      cycleRef.current = setTimeout(() => {
        cycleToNextIcon();
      }, delay);
    }, 500); // Morph duration
  };

  // Handle hover events
  const handleMouseEnter = () => {
    setIsHovered(true);
    clearTimers();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    startIconCycle();
  };

  // Initialize animation cycle when conditions are right
  useEffect(() => {
    startIconCycle();
    return clearTimers;
  }, [isIdle, isActive, isLoading, isHovered]);

  // Reset to search icon when not idle
  useEffect(() => {
    if (!isIdle && currentIcon !== 0) {
      setCurrentIcon(0);
    }
  }, [isIdle, currentIcon]);

  const currentIconData = iconPaths[currentIcon];

  return (
    <motion.div
      className="flex items-center justify-center"
      initial={{ scale: 1 }}
      animate={{
        scale: isHovered ? 1.1 : 1,
        rotate: isHovered ? 5 : 0
      }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          {currentIconData.paths.map((path, index) => (
            <motion.path
              key={`${currentIcon}-${index}`}
              d={path.d}
              strokeWidth={path.strokeWidth}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 1,
                transition: {
                  pathLength: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.3 }
                }
              }}
            />
          ))}
        </motion.svg>
      </AnimatePresence>
    </motion.div>
  );
};
