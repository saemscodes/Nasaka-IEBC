
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedSearchIconProps {
  className?: string;
  isLoading?: boolean;
  isActive?: boolean;
}

const AnimatedSearchIcon: React.FC<AnimatedSearchIconProps> = ({ 
  className = "w-4 h-4 text-green-600 dark:text-green-400",
  isLoading = false,
  isActive = false 
}) => {
  const [currentIcon, setCurrentIcon] = useState('search');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Define icon paths optimized for morphing
  const iconPaths = {
    search: {
      paths: [
        "M11 11 A8 8 0 1 0 11 11 A8 8 0 1 0 11 11 Z", 
        "M21 21 L16.65 16.65 L21 21 Z"
      ],
      scale: 1,
      rotation: 0
    },
    book: {
      paths: [
        "M6.5 2 L20 2 L20 22 L6.5 22 A2.5 2.5 0 0 1 4 19.5 L4 4.5 A2.5 2.5 0 0 1 6.5 2 Z",
        "M4 19.5 A2.5 2.5 0 0 1 6.5 17 L20 17 L20 17 Z"
      ],
      scale: 1.1,
      rotation: 0
    },
    paper: {
      paths: [
        "M6 2 A2 2 0 0 0 4 4 L4 20 A2 2 0 0 0 6 22 L18 22 A2 2 0 0 0 20 20 L20 7.5 L14.5 2 Z",
        "M14 2 L14 8 L20 8 L20 8 Z"
      ],
      scale: 1.05,
      rotation: 0
    },
    folder: {
      paths: [
        "M4 4 L4 20 A2 2 0 0 0 6 22 L18 22 A2 2 0 0 0 20 20 L20 8 A2 2 0 0 0 18 6 L13 6 L9 4 L6 4 A2 2 0 0 0 4 4 Z",
        "M4 4 L4 4 L4 4 L4 4 Z"
      ],
      scale: 1.08,
      rotation: 0
    }
  };

  const animationSequence = ['search', 'book', 'paper', 'folder', 'search'];
  const sequenceTimings = [300, 1500, 1500, 1500, 5000];

  useEffect(() => {
    if (isLoading || isActive) {
      if (animationRef.current) clearTimeout(animationRef.current);
      setCurrentIcon('search');
      setIsTransitioning(false);
      return;
    }

    if (!isHovered) {
      const startAnimationCycle = () => {
        let currentIndex = 0;
        
        const runSequence = () => {
          try {
            if (currentIndex < animationSequence.length) {
              const nextIcon = animationSequence[currentIndex];
              const timing = sequenceTimings[currentIndex];
              
              if (currentIndex > 0) {
                setIsTransitioning(true);
                
                setTimeout(() => {
                  setCurrentIcon(nextIcon);
                  setTimeout(() => setIsTransitioning(false), 600);
                }, 100);
              } else {
                setCurrentIcon(nextIcon);
              }
              
              animationRef.current = setTimeout(() => {
                currentIndex++;
                if (currentIndex >= animationSequence.length) {
                  currentIndex = 0;
                  setTimeout(runSequence, 1000);
                } else {
                  runSequence();
                }
              }, timing);
            }
          } catch (error) {
            console.error('Animation sequence error:', error);
            setCurrentIcon('search');
            setIsTransitioning(false);
          }
        };

        runSequence();
      };

      startAnimationCycle();
    }

    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [isLoading, isActive, isHovered]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (animationRef.current) clearTimeout(animationRef.current);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCurrentIcon('search');
    setIsTransitioning(false);
  };

  const currentIconData = iconPaths[currentIcon];

  const iconVariants = {
    initial: { 
      scale: 0.8, 
      opacity: 0,
      rotate: -10
    },
    animate: { 
      scale: currentIconData.scale,
      opacity: 1,
      rotate: currentIconData.rotation,
      transition: {
        type: "spring" as const,
        damping: 15,
        stiffness: 300,
        duration: 0.6
      }
    },
    exit: { 
      scale: 0.9, 
      opacity: 0,
      rotate: 10,
      transition: {
        duration: 0.3
      }
    },
    hover: {
      scale: currentIconData.scale * 1.25,
      rotate: currentIconData.rotation + 5,
      transition: {
        type: "spring" as const,
        damping: 10,
        stiffness: 400
      }
    }
  };

  const pathVariants = {
    initial: { 
      pathLength: 0,
      opacity: 0
    },
    animate: { 
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: {
          type: "spring" as const,
          damping: 20,
          stiffness: 100,
          duration: 0.8
        },
        opacity: {
          duration: 0.4
        }
      }
    },
    exit: { 
      pathLength: 0,
      opacity: 0,
      transition: {
        duration: 0.3
      }
    }
  };

  const bounceVariants = {
    initial: { y: 0 },
    bounce: { 
      y: [0, -8, 0],
      transition: {
        duration: 0.6,
        times: [0, 0.5, 1],
        ease: "easeOut" as const
      }
    }
  };

  return (
    <motion.div 
      className="relative inline-block cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      animate={isTransitioning ? "bounce" : "initial"}
      variants={bounceVariants}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIcon}
          variants={iconVariants}
          initial="initial"
          animate={isHovered ? "hover" : "animate"}
          exit="exit"
          className="relative"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
          >
            {currentIconData.paths.map((pathData, index) => (
              <motion.path
                key={`${currentIcon}-${index}`}
                d={pathData}
                variants={pathVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                stroke="currentColor"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
          
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: 0.3, 
                  scale: 1.4,
                  transition: {
                    type: "spring" as const,
                    damping: 20,
                    stiffness: 300
                  }
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 bg-green-500 rounded-full blur-sm -z-10"
              />
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
      
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: [0, 0.1, 0], 
              scale: [0.8, 1.3, 0.8],
              transition: {
                duration: 0.8,
                ease: "easeInOut" as const
              }
            }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-current rounded-full -z-10"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AnimatedSearchIcon;
