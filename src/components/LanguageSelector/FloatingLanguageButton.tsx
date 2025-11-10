import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  type LanguageConfig, 
  getLanguagePersonality,
  type LanguagePersonality 
} from '@/i18n/languageRegistry';

interface FloatingLanguageButtonProps {
  language: LanguageConfig;
  position: { x: number; y: number };
  index: number;
  isHoveringMain: boolean;
  onSelect: (code: string) => void;
  isSelected: boolean;
  physicsStatesRef: React.MutableRefObject<Map<string, any>>;
}

const FloatingLanguageButton: React.FC<FloatingLanguageButtonProps> = ({
  language,
  position,
  index,
  isHoveringMain,
  onSelect,
  isSelected,
  physicsStatesRef
}) => {
  const { theme } = useTheme();
  const personality = getLanguagePersonality(language.code);
  
  // Physics-based motion values
  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);
  const rotation = useMotionValue(0);
  
  // Spring physics for smooth movement
  const springX = useSpring(x, {
    stiffness: personality.stiffness,
    damping: personality.damping,
    mass: personality.mass
  });
  
  const springY = useSpring(y, {
    stiffness: personality.stiffness,
    damping: personality.damping,
    mass: personality.mass
  });
  
  const springRotation = useSpring(rotation, {
    stiffness: 60,
    damping: 15
  });

  const floatAnimationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const currentPhaseRef = useRef<number>(personality.floatPhase);
  const baseXRef = useRef<number>(position.x);
  const baseYRef = useRef<number>(position.y);

  // Initialize or update physics state
  useEffect(() => {
    const stateId = `${language.code}-${index}`;
    baseXRef.current = position.x;
    baseYRef.current = position.y;

    if (!physicsStatesRef.current.has(stateId)) {
      physicsStatesRef.current.set(stateId, {
        x: position.x,
        y: position.y,
        velocityX: (Math.random() - 0.5) * 20, // Reduced velocity for closer range
        velocityY: (Math.random() - 0.5) * 20,
        rotation: 0
      });
    }

    // Set initial position
    x.set(position.x);
    y.set(position.y);
  }, [language.code, index, position.x, position.y, x, y, physicsStatesRef]);

  // Floating animation with individual personality
  useEffect(() => {
    if (isHoveringMain) {
      // When hovering main button, smoothly return to exact position
      if (floatAnimationRef.current) {
        cancelAnimationFrame(floatAnimationRef.current);
      }
      x.set(baseXRef.current);
      y.set(baseYRef.current);
      rotation.set(0);
      return;
    }

    const animateFloat = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const stateId = `${language.code}-${index}`;
      const state = physicsStatesRef.current.get(stateId);
      
      if (state) {
        // Update phase for floating motion
        currentPhaseRef.current += deltaTime * personality.floatFrequency;
        
        // Calculate floating offset based on personality (reduced amplitude for closer positioning)
        const floatX = Math.sin(currentPhaseRef.current + personality.floatPhase) * (personality.floatAmplitude * 0.6);
        const floatY = Math.cos(currentPhaseRef.current * 0.7 + personality.floatPhase) * (personality.floatAmplitude * 0.6);
        
        // Gentle rotation
        const targetRotation = Math.sin(currentPhaseRef.current * 0.5) * (personality.rotationRange * 0.5);
        
        // Update position with floating motion
        const targetX = baseXRef.current + floatX;
        const targetY = baseYRef.current + floatY;
        
        x.set(targetX);
        y.set(targetY);
        rotation.set(targetRotation);

        physicsStatesRef.current.set(stateId, {
          ...state,
          x: targetX,
          y: targetY,
          rotation: targetRotation
        });
      }

      floatAnimationRef.current = requestAnimationFrame(animateFloat);
    };

    floatAnimationRef.current = requestAnimationFrame(animateFloat);

    return () => {
      if (floatAnimationRef.current) {
        cancelAnimationFrame(floatAnimationRef.current);
      }
    };
  }, [
    isHoveringMain, 
    position.x, 
    position.y, 
    language.code, 
    index, 
    personality, 
    x, 
    y, 
    rotation,
    physicsStatesRef
  ]);

  const handleClick = () => {
    // Add a little bounce effect when selected
    rotation.set(rotation.get() + 10);
    setTimeout(() => rotation.set(0), 200);
    onSelect(language.code);
  };

  return (
    <motion.button
      className={`floating-language-button ${theme} ${isSelected ? 'selected' : ''}`}
      style={{
        x: springX,
        y: springY,
        rotate: springRotation
      }}
      initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 400, // Increased stiffness for snappier movement
        damping: 25,
        delay: index * 0.08 // Reduced delay for faster appearance
      }}
      whileHover={{ 
        scale: 1.2,
        transition: { duration: 0.15 }
      }}
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      aria-label={`Switch to ${language.nativeName}`}
    >
      <span 
        className="language-code"
        style={{
          color: personality.color,
          fontWeight: '800',
          fontSize: '10px',
          letterSpacing: '0.5px'
        }}
      >
        {language.code.toUpperCase()}
      </span>
      
      {/* Personality indicator glow */}
      <motion.div
        className="personality-glow"
        style={{
          backgroundColor: personality.color
        }}
        animate={{
          opacity: [0.2, 0.4, 0.2],
          scale: [1, 1.05, 1]
        }}
        transition={{
          duration: personality.floatFrequency * 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </motion.button>
  );
};

export default FloatingLanguageButton;
